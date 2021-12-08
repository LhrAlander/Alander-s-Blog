## 前置知识
我们可以将 `React` 的工作流程划分为几大块：


1. `render` 阶段：主要生成 `Fiber节点`  并构建出完整的 `Fiber树` 
2. `commit` 阶段：在上一个`render` 阶段中会在 `rootFiber` 上生成一条副作用链表，应用的`DOM操作`就会在本阶段执行

`commit`阶段的工作主要分为三部分，对应到源码中的函数名是：  

- `commitBeforeMutationEffects`阶段：主要处理执行DOM操作前的一些相关操作
- `commitMutationEffects`阶段：执行`DOM操作`
- `commitLayoutEffects`阶段：主要处理执行DOM操作后的一些相关操作

`useEffect` 和 `useLayoutEffect` 的区别主要就在体现在这三个阶段的处理上。 结论是：
1. `useEffect` 会异步地去执行它的响应函数和上一次的销毁函数。
2. `useLayoutEffect` 会同步地执行它的响应函数和上一次的销毁函数，即会阻塞住 `DOM渲染`。

## useEffect
### commitBeforeMutationEffects
在这个阶段中 `useEffect` 着重会经历一句话如下：
```js
function commitBeforeMutationEffects() {
  while (nextEffect$1 !== null) {
    // 一系列的赋值操作省略，这里的flags应取自对应FunctionComponent的effect的flags，具体实现请看源码
    var flags = effect.flags;

		// 处理生命周期
    if ((flags & Snapshot) !== NoFlags) {
      setCurrentFiber(nextEffect$1);
      commitBeforeMutationLifeCycles(current, nextEffect$1);
      resetCurrentFiber();
    }

	// 这个if判断只有 useEffect 为 true，useLayoutEffect 为false
    if ((flags & Passive) !== NoFlags) {
      // If there are passive effects, schedule a callback to flush at
      // the earliest opportunity.
      if (!rootDoesHavePassiveEffects) {
        rootDoesHavePassiveEffects = true;
	// 这里就是 useEffect 异步的原因，DOM操作后React会调度 flushPassiveEffects
        scheduleCallback(NormalPriority, function () {
          flushPassiveEffects();
          return null;
        });
      }
    }

    nextEffect$1 = nextEffect$1.nextEffect;
  }
}
```
### commitMutationEffects
在这个阶段中，`React` 会进行一系列的`DOM节点更新` ，然后会执行一个方法: `commitHookEffectListUnmount(HookLayout | HookHasEffect, finishedWork);`

那么一个拥有 `useEffect` 的 `Functional Component` 在这个阶段是不符合 `unmount` 的判断逻辑的，所以在这个地方不会做 `unmount` 操作。

### commitLayoutEffects
在这个阶段中，依然有一个很重要的方法存在：`commitHookEffectListMount(HookLayout | HookHasEffect, finishedWork);` 

这个if判断和上一阶段的if判断是一样的，`useEffec` 在这个判断中不会做任何操作。

### 后续阶段
在完成了 `commitLayoutEffects` 后，还有一个操作：
```js
if (rootDoesHavePassiveEffects) {
    // This commit has passive effects. Stash a reference to them. But don't
    // schedule a callback until after flushing layout work.
    rootDoesHavePassiveEffects = false;
    rootWithPendingPassiveEffects = root;
    pendingPassiveEffectsLanes = lanes;
    pendingPassiveEffectsRenderPriority = renderPriorityLevel;
  } 
```
即把 `rootWithPendingPassiveEffects` 置为 `root` ，这么做的原因和第一阶段 `commitBeforeMutationEffects` 中 `useEffect` 注册的下一次 `flushPassiveEffects` 异步调度有关，我们看以下 `flushPassiveEffects` 的实现：
```js
function flushPassiveEffectsImpl() {
	if (rootWithPendingPassiveEffects === null) {
    return false;
  }
	// 省略一系列的性能追踪等操作
	commitPassiveUnmountEffects(root.current);
  commitPassiveMountEffects(root, root.current);
}

```
从上述代码段可以看见，`useEffect` 在第一阶段注册的调度回调会在页面更新后进行 `unmount` 和 `mount` 操作。值得一提的是，这个回调中effect的注册时机就是在` commitLayoutEffects` 阶段。

## useLayoutEffect
其实根据我们对 `useEffect` 的解析来看，就是在 `commitMutationEffects` 和 `commitLayoutEffects` 阶段中各自的 if 判断中，`useLayoutEffect` 是通过if判断的，所以在 `commitMutationEffects` 阶段中，同步执行了`useLayoutEffect` 的上一次销毁函数，在 `commitLayoutEffects` 阶段中，同步执行了 `useLayoutEffect` 本次的执行函数，并注册上销毁函数。

## 结论
至此，我们粗略地查看了 `commit` 阶段的代码，分析了以下为什么 `useEffect` 是异步执行，而 `useLayoutEffect` 是同步执行，具体的代码我没有太过在文章中贴出来，因为这些都是可变的，真正的流程性的概览和 `React` 团队设计这一套机制的心智模型需要我们自己在不断调试代码和理解中慢慢去熟悉。

后续自己感兴趣的是 `hooks` 的实现，其中比较关键的 `useReducer` 会着重看一下源码，看看能不能写个简易版本的放到支付宝小程序中去实现一个 `自定义的支付宝hooks` 用于日常生产力开发。

## 补充于 2021/12/8
初写这篇文章的时候我还没有细读`Scheduler`的代码，只知道当使用了`Scheduler_callback`方法后，注册的回调会在下个事件队列中执行，但是明没有深究为什么。最近读完了Scheduler的源码后（作为单独的一个库，而非一定需要和React绑定），理解了是如何调度的，简单来说就是通过`window.postMessage()` 来不停开启调度，然后在`on('message', handler)`中去处理，所以上文提到的`useEffect`的执行即`flushPasiveEffects`是异步的。

同时上文中提到的源码中的`if((flags & Passive) !== NoFlags)`这个判断也没有讲明何时为fiber的flag ｜ Passive的，这里补充一下就是在我们调用函数式组件的时候，使用`useEffect`的时候就会执行这个flag的操作。
