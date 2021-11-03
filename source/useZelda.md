# 背景
当我们写React的时候我们该考虑什么？对于一部分同学会花费大量精力去研读React特性的部分源码，在实践中应用起来，对他们来说心智负担=0。对于大部分api调用者来说，可能考虑更多的是如何组织数据并让数据按照预期地渲染在页面上。

React带来的hooks比较完美地解决了这个问题，在 *变与不变* 间提供了 ``useRef`` 和 ``useReducer``，我们着重理解下 [useReducer](https://zh-hans.reactjs.org/docs/hooks-reference.html#usereducer)，告诉reducer 需要做的动作，reducer会负责更新数据并渲染页面。

# 痛点
来看下一个reducer的demo：
```js
const initialState = {count: 0};

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return {count: state.count + 1};
    case 'decrement':
      return {count: state.count - 1};
    default:
      throw new Error();
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <>
      Count: {state.count}
      <button onClick={() => dispatch({type: 'decrement'})}>-</button>
      <button onClick={() => dispatch({type: 'increment'})}>+</button>
    </>
  );
}
```
reducer本身是个函数，在这里面处理各种case，最终目的是返回下一个状态数据。这个模式如果正常写下来其实是不适合业务代码堆砌的：
  - 不适合逻辑分离和复用
  - 不适合流式处理业务逻辑和逻辑组合

比如：初始化业务的时候需要做：获取用户 + 获取配置，过程中还有单独的业务：获取用户、获取配置。代码组织方面比较繁琐。

如果抛开React谈业务是不是下面这段代码更加合适：
```js
class Service {
  state = {
    user: undefined,
    config: undefined
  }

  fetchUser() {}

  fetchConfig() {}

  init() {
    fetchUser();
    fetchConfig();
  }
}
```
useZelda 只是最简单地去向这个方向靠近，代码如下：
```js
function useZelda(_class) {
  const {current: entity} = useRef(typeof _class ? new _class() : _class);
  const [reducer, dispatch] = useReducer(function (prevState, action) {
    if (action.payload) {
      return action.payload;
    }
    return prevState;
  }, entity.state);

  const proxy = new Proxy(entity, {
    get (target, p, receiver) {
      if (p === 'state') {
        return new Proxy(target.state, {
          get (target, p, receiver) {
            return target[p];
          },
          set() {
            return false;
          }
        });
      }

      const source = target[p];
      if (typeof source === 'function') {
        return function(...args) {
          const result = source.apply(target, args);
          if (result === undefined) {
            return;
          }

          if (result && typeof result === 'object' && typeof result.then === 'function') {
            return result;
          }

          entity.state = result;
          dispatch({ payload: result });
        }
      }
    },
    set (target, p, value, receiver) {
      console.log('set', target, p, value, receiver);
      if (p === 'state') {
        return false;
      }

      target[p] = value;
      return true;
    }
  });

  return proxy;
}
```
这段代码是一段雏形，它具备了上述的写法，如果往后续发展，将中间件思想、分支概念、快照概念等各种想法加入进来可能会变成一个庞大的库，我也在项目中使用了dva，也许这种思想发展成另一条路就是dva的处理数据的方式。

它是一个种子，是开放的，在日常公司业务代码中也扩展了这个库到非React应用中去：支付宝小程序。它是自由的，带给我的是想法和开放，所以我命名为Zelda，希望它的路是广阔的。

[github](https://github.com/LhrAlander/code-snippet/blob/master/useZelda.js)
