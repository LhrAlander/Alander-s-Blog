> 在React官网中有对于concurrent模式的概念描述，提取关键词：可中断渲染、并发。如果在没有阅读过源码的情境下其实对于这两个关键词应该大部分人都不清楚是什么意思，即使它们两个词语看起来是这么简单。

# 渲染
什么是渲染？反正我在没有阅读源码前的理解就是：将数据呈现在浏览器屏幕上。但实际上这是错误的。在阅读官网可以知道React的执行过程为：
>从概念上讲，React 分两个阶段工作：
> - **渲染** 阶段会确定需要进行哪些更改，比如 DOM。在此阶段，React 调用 render，然后将结果与上次渲染的结果进行比较。
> - **提交** 阶段发生在当 React 应用变化时。（对于 React DOM 来说，会发生在 React 插入，更新及删除 DOM 节点的时候。）在此阶段，React 还会调用 componentDidMount 和 componentDidUpdate 之类的生命周期方法。

那我们就知道了，渲染其实并不是将内容绘制，而是计算出来需要绘制什么，这其实就是reconcile的过程，我们这里不做更深的讨论，只需要了解很基础的概念：
1. React 16.x和更高版本的实现都是采用Fiber架构
2. React 会一次性将内容提交并绘制（注意不是渲染，牢记渲染的定义）
3. 如何描述一个React应用？其实整个React应用就是一颗Fiber树

理解上面三点基础概念我们能做出推理：
1. React一定需要计算出下一次提交绘制的完整fiber树
2. 每次更新其实就是在计算新的fiber树
3. 既然有新的fiber树，就一定有旧的fiber树即当前绘制在页面上的fiber树
4. 既然有两颗fiber树，那么新的fiber树一定是从旧的fiber树经过一系列算法计算得出

如果理解了上述推理，那么我们可以说，*渲染* 就是在做推论第四点的工作，即递归生成一颗新的fiber树。

# 可中断
理解了上文中渲染的定义以后，可中断就比较好理解了。中断的是渲染，中断的是生成新Fiber树的过程。

## 在哪里中断
最容易想到的是，渲染流程要生成fiber树，那一棵树的最小单元就是节点，即我们在完成了某一个fiber节点的渲染工作的时候，可以被中断，停止下一个fiber节点的渲染工作。

除了这种中断以外，下文讨论的并行，即打断整颗fiber树的渲染流程，也被很多文章理解成中断渲染，但是我不这么认为，因为本质是取消，后文再讨论。

## 怎么中断
我们以目标为结果导向：我们需要暂停本次Fiber树的渲染，等待合适的时机再从断点恢复，继续后续的fiber节点的渲染流程。

这个工作就是Scheduler这个package做的事情。

# Scheduler
根据这个package的介绍：
> This is a package for cooperative scheduling in a browser environment. It is currently used internally by React, but we plan to make it more generic.
>
> The public API for this package is not yet finalized.

可以了解到，这个包是通用的，不是为了React专门而生的，这有助于我们理解代码，因为我们暂时不需要关心React的逻辑了。

先说结论：
1. 我们将调度的最小单位称为task
2. 每个task会有优先级
3. task会根据优先级来生成该任务的过期时间
4. 任务的执行顺序应该是根据过期时间排序
5. 既然是在浏览器中执行任务，这个包的目的是不影响浏览器绘制，所以执行任务的时间不应该超过一定的时间，比如5ms；同时任务执行的时期应该是在浏览器空闲时间执行
6. 应该可以让一个task中止和继续执行

那么为了实现结论中的第四第五点，scheduler做了以下几件事情
1. 将任务根据过期时间排序放在一个小顶堆中
2. 采用MessageChannel的postMessage和onmessage来处理任务
3. 不停地从小顶堆中拿出任务来执行，执行完查看是否还有任务，继续执行，如此往复

这几件事情就是调度的核心功能。虽然我很不愿意在我的一些抽象性文章中展示代码，但是这里确实代码比较简洁：
```js
function workLoop(hasTimeRemaining, initialTime) {
  let currentTime = initialTime;
  advanceTimers(currentTime);
  currentTask = peek(taskQueue);
  while (
    currentTask !== null &&
    !(enableSchedulerDebugging && isSchedulerPaused)
  ) {
    if (
      currentTask.expirationTime > currentTime &&
      (!hasTimeRemaining || shouldYieldToHost())
    ) {
      break;
    }
    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      currentTask.callback = null;
      currentPriorityLevel = currentTask.priorityLevel;
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      markTaskRun(currentTask, currentTime);
      const continuationCallback = callback(didUserCallbackTimeout);
      currentTime = getCurrentTime();
      if (typeof continuationCallback === 'function') {
        currentTask.callback = continuationCallback;
        markTaskYield(currentTask, currentTime);
      } else {
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
      }
      advanceTimers(currentTime);
    } else {
      pop(taskQueue);
    }
    currentTask = peek(taskQueue);
  }
}
```
关于上述代码：
1. shouldYieldToHost：当前任务开始时间+5ms，如果当前时间剩余了，就可以继续任务，反之即中断
2. continuationCallback 如果是一个function，就会在下一次执行中执行这个callback，即恢复

举个例子来讲解中断与恢复：
1. 假设TaskA可以被分为五个子任务：TaskA_1, TaskA_2, TaskA_3, Task_4, Task_5; 每个子任务都需要5.2ms完成。
2. TaskA真正执行的函数为functionA
3. functionA会while循环遍历子任务，当当前时间没有到达deadline的时候，继续下一个子任务执行，否则停止执行任务，同时返回functionA
4. 在每个子任务执行完毕以后functionA可以通过某些手段保存下来子任务的结果作为中间状态，这样当最后一个子任务执行完就得到了完整的状态

根据上述例子配合代码我们看一下执行过程：
1. 生成TaskA
2. 在第0ms开始调度TaskA，此时deadline为 0 + 5 = 5ms，开始执行functionA
3. 完成了TaskA_1，此时TaskA保存下来了state1作为中间状态，此时发现超过deadline了，TaskA应该被中断，所以返回了 functionA
4. scheduler 得到了functionA的返回值发现是个函数，说明taskA还需要继续被调度，将taskA的callback继续设置为functionA，并且postmessage，在下一次任务队列中继续调度functionA
5. onmessage中，先将deadline更新，然后functionA得到执行，由于已经有了stateA，执行TaskA_2继续执行就有了旧状态，执行完后，发现时间到达了deadline，停止执行，并记录下state2，等待下次调度
6. 当所有的子任务完成后，functionA即完成，返回null
7. scheduler 接受到functionA返回是null，知道taskA完成了，就剔除taskA，取下一个任务进行执行

这就是最普遍的中断更新，我们把React的渲染函数比作functionA，每个fiber节点的渲染工作比作子任务，带入到scheduler中去，就明白一次渲染工作中是怎么做到不阻塞ui的绘制而得到渲染的。


# 插队
这个概念也是很多文章说的中断更新。例如，我们认为用户输入所造成的更新的优先级应该是高于某个普通更新的，示例如下：
```ts
function App() {
  const [count, setCount] = useState(0);
  const divRef = useRef();

  const handleClick = () => {
    setCount(c => c + 2);
  }
  
  useEffect(() => {
    setTimeout(() => {
      setCount(1);
    }, 1000)
    setTimeout(() => {
      divRef.current.click();
    }, 1040)
  }, []);

  return (
    <div ref={divRef} onClick={handleClick}>
      new Array(10000).map(() => count);
    </div>
  )
}
```

我们假设完成App对应的fiber节点由于计算量比较大需要1s。

当mounted过了1000ms以后，触发了一次更新，试图将count设置成1，我们将这次的Fiber树渲染任务称为TaskA，这个过程如果需要1000ms时间完成，那么在其执行了40ms以后，程序模拟用户点击的操作触发了一次更新试图将count + 2，我们将这次的Fiber树渲染任务称为TaskB。

同时我们认为TaskB的优先级是高于TaskA的，即系统希望停止TaskA任务，优先进行TaskB任务，怎么做？我们来分析以下scheduler此时的任务状态：
1. 当TaskA生成时，taskQueue中塞进去，此时taskQueue：[{ callback: TaskA, id: TaskA }];
2. 当TaskB生成时，React判断TaskB的优先级比正在执行的TaskA优先级要高，所以取消了TaskA，取消的方法即将taskQueue中对应的Task的callback设为null。同时taskQueue将TaskB塞入堆中，由于是小顶堆且TaskB优先级目前最高，所以此时taskQueue中：[{ callback: TaskB, id: TaskB }, { callback: null, id: TaskA }]; 此时scheduler还在等待TaskA的子任务，即某个Fiber节点的渲染结束，发现超时，同时React发现刚刚进行的TaskA的优先级已经比要执行的TaskB的优先级要低了，所以不回返回渲染函数，而是返回null，所以scheduler也不会将callback设为TaskA。
3. TaskA的最后一次子fiber节点渲染完成以后，取出taskQueue中的任务，即TaskB，执行它，顺利完成。
4. 而React在执行完渲染的时候又会调用一次渲染函数确保所有的优先级的任务（在react中体现为lane）都被塞入taskQueue，所以当TaskB执行完以后，其实新生成了一个TaskA进入taskQueue进行调度。

经过上面的解释，我个人其实不认为那是中断与恢复，那是 **取消** 任务，和重新根据旧状态再来一个新的渲染任务。

# 结语
本文依然没有大幅度地拿源码来解释，因为这里面的思路我认为才是最重要的。同时这篇文章也是我自己学习的方法：我在接触新的知识的时候优先以结果为导向看看需要什么，再去尝试理解为了期望目标做出了怎样的改动。所以我们没有关心很多事情：为什么onClick的优先级就比setTimeout的那个1的优先级要高？scheduler是如何判断优先级的？React到底是怎么接入scheduler实现调度渲染的？

在我读完源码的时候我知道这些其实真的不重要，为了实现优先级有了scheduler，有了scheduler所以React需要做一些事情去体现、计算优先级所以有了lane，其实这些都是水到渠成的过程。

有了思路我们才能更好地往前走，共勉。


