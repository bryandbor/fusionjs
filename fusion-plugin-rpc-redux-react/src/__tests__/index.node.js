/** Copyright (c) 2018 Uber Technologies, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import React from 'react';
import test from 'tape-cup';
import ShallowRenderer from 'react-test-renderer/shallow';

import App, {createPlugin} from 'fusion-core';
import ReactApp from 'fusion-react';
import type {Context} from 'fusion-core';
import {getService, getSimulator} from 'fusion-test-utils';
import {UniversalEventsToken} from 'fusion-plugin-universal-events';
import {Provider} from 'react-redux';

import Plugin from '../plugin';
import {mock, ResponseError, RPCToken, RPCHandlersToken} from '../index';
import {withRPCRedux, withRPCReactor} from '../hoc';

/* Test helpers */
function createMockEmitter(props: mixed) {
  const emitter = {
    from: () => {
      return emitter;
    },
    emit: () => {},
    setFrequency: () => {},
    teardown: () => {},
    map: () => {},
    on: () => {},
    off: () => {},
    mapEvent: () => {},
    handleEvent: () => {},
    flush: () => {},
    ...props,
  };
  return emitter;
}

test('plugin', t => {
  t.equals(typeof Plugin.provides, 'function');
  const handlers = {test() {}};
  const EventEmitter = createMockEmitter();

  const appCreator = () => {
    const app = new App('content', el => el);
    app.register(RPCHandlersToken, handlers);
    app.register(UniversalEventsToken, EventEmitter);
    return app;
  };

  const RPCRedux = getService(appCreator, Plugin);
  const mockCtx: Context = ({headers: {}, memoized: new Map()}: any);
  t.equal(typeof RPCRedux.from(mockCtx).request, 'function');
  t.end();
});

test('mock plugin', t => {
  t.equals(typeof mock.provides, 'function');
  const handlers = {test() {}};

  const appCreator = () => {
    const app = new App('content', el => el);
    app.register(RPCHandlersToken, handlers);
    return app;
  };

  const RPCRedux = getService(appCreator, mock);
  const mockCtx: Context = ({headers: {}, memoized: new Map()}: any);
  t.equal(typeof RPCRedux.from(mockCtx).request, 'function');
  t.end();
});

test('withRPCRedux hoc', async t => {
  function Test(props) {
    didRender = true;
    console.log({props});
    t.equal(
      typeof props.test,
      'function',
      'passes the handler through to props'
    );
    props.test('test-args');
    return null;
  }
  const expectedActions = ['TEST_START', 'TEST_SUCCESS'];
  const expectedPayloads = ['test-args', 'test-resolve'];
  const store = {
    dispatch(action) {
      t.equal(action.type, expectedActions.shift());
      t.equal(action.payload, expectedPayloads.shift());
    },
    getState() {},
    subscribe() {},
  };
  t.equals(typeof withRPCRedux, 'function');
  const Connected = withRPCRedux('test')(Test);
  t.equals(Connected.displayName, 'WithRPCRedux(Test)');

  let didRender = false;
  const root = React.createElement(
    Provider,
    {store},
    React.createElement(Connected),
  );
  const app = new ReactApp(root);
  app.register(RPCToken, mock);
  app.register(RPCHandlersToken, createPlugin({
    provides() {
      return {
        request(method, args) {
          t.equal(method, 'test');
          t.equal(args, 'test-args');
          return Promise.resolve('test-resolve');
        },
      };
    }
  }));

  const sim = getSimulator(app);
  const ctx = await sim.render('/');
  // t.ok(typeof ctx.body === 'string' && ctx.body.includes('hello'), 'renders');
  t.ok(didRender);
  t.end();

  /*
  t.equal(
    typeof rendered.props.test,
    'function',
    'passes the handler through to props'
  );
  rendered.props.test('test-args');
  t.end();
  */
});

test.skip('withRPCReactor hoc', t => {
  function Test() {
    return null;
  }
  t.equals(typeof withRPCReactor, 'function');
  const Connected = withRPCReactor('test', {
    start() {},
    success() {},
    failure() {},
  })(Test);
  t.equals(Connected.displayName, 'WithRPCRedux(Test)');
  const renderer = new ShallowRenderer();
  const expectedActions = ['TEST_START', 'TEST_SUCCESS'];
  const expectedPayloads = ['test-args', 'test-resolve'];
  renderer.render(React.createElement(Connected), {
    rpc: {
      request(method, args) {
        t.equal(method, 'test');
        t.equal(args, 'test-args');
        return Promise.resolve('test-resolve');
      },
    },
    store: {
      dispatch(action) {
        t.equal(action.type, expectedActions.shift());
        t.equal(action.payload, expectedPayloads.shift());
      },
      getState() {},
    },
  });
  const rendered = renderer.getRenderOutput();
  t.equal(
    typeof rendered.props.test,
    'function',
    'passes the handler through to props'
  );
  rendered.props.test('test-args');
  t.end();
});

test('ResponseError', t => {
  const e = new ResponseError('test');
  t.ok(e instanceof Error);
  t.end();
});
