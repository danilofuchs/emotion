import React, { useContext } from 'react'
import EmotionStyled from '@emotion/styled'
import ReactDOMServer from 'react-dom/server.js'
import Benchmark from 'benchmark'
import { jsx, css, CacheProvider } from '@emotion/react'
import { createTriangle } from './triangle.js'
import { css as cssClassName } from '@emotion/css'
import { renderStylesToString } from '@emotion/server'
import EmotionServer from '@emotion/server/create-instance/dist/emotion-server-create-instance.cjs.js'
import EmotionCache from '@emotion/cache'
import { insertStyles } from '@emotion/utils'

const styled = EmotionStyled.default
const createCache = EmotionCache.default
const createEmotionServer = EmotionServer.default
const { renderToString } = ReactDOMServer

let Triangle = createTriangle(styled.div`
  position: absolute;
  cursor: pointer;
  width: 0;
  height: 0;
  border-color: transparent;
  border-style: solid;
  border-top-width: 0;
  transform: translate(50%, 50%);
  margin-left: ${props => props.x + 'px'};
  margin-top: ${props => props.y + 'px'};
  border-right-width: ${props => props.size / 2 + 'px'};
  border-bottom-width: ${props => props.size / 2 + 'px'};
  border-left-width: ${props => props.size / 2 + 'px'};
  border-bottom-color: ${props => props.color};
`)

let CssPropTriangle = createTriangle(({ x, y, size, color, ...props }) => {
  return jsx('div', {
    css: css`
      position: absolute;
      cursor: pointer;
      width: 0;
      height: 0;
      border-color: transparent;
      border-style: solid;
      border-top-width: 0;
      transform: translate(50%, 50%);
      margin-left: ${x + 'px'};
      margin-top: ${y + 'px'};
      border-right-width: ${size / 2 + 'px'};
      border-bottom-width: ${size / 2 + 'px'};
      border-left-width: ${size / 2 + 'px'};
      border-bottom-color: ${color};
    `,
    ...props
  })
})

let CssFuncTriangle = createTriangle(({ x, y, size, color, ...props }) => {
  return React.createElement('div', {
    className: cssClassName`
      position: absolute;
      cursor: pointer;
      width: 0;
      height: 0;
      border-color: transparent;
      border-style: solid;
      border-top-width: 0;
      transform: translate(50%, 50%);
      margin-left: ${x + 'px'};
      margin-top: ${y + 'px'};
      border-right-width: ${size / 2 + 'px'};
      border-bottom-width: ${size / 2 + 'px'};
      border-left-width: ${size / 2 + 'px'};
      border-bottom-color: ${color};
    `,
    ...props
  })
})
let CacheContext = CacheProvider._context

let hasOwnProperty = Object.prototype.hasOwnProperty

let ExperimentTriangle = createTriangle(({ x, y, size, color, ...props }) => {
  let className = ''
  const serialized = css`
    position: absolute;
    cursor: pointer;
    width: 0;
    height: 0;
    border-color: transparent;
    border-style: solid;
    border-top-width: 0;
    transform: translate(50%, 50%);
    margin-left: ${x + 'px'};
    margin-top: ${y + 'px'};
    border-right-width: ${size / 2 + 'px'};
    border-bottom-width: ${size / 2 + 'px'};
    border-left-width: ${size / 2 + 'px'};
    border-bottom-color: ${color};
  `

  const cache = useContext(CacheContext)
  const rules = insertStyles(cache, serialized, true)
  className += `${cache.key}-${serialized.name}`

  const newProps = {}
  for (let key in props) {
    if (hasOwnProperty.call(props, key)) {
      newProps[key] = props[key]
    }
  }

  newProps.className = className

  const ele = React.createElement('div', newProps)
  let serializedNames = serialized.name
  let next = serialized.next
  while (next !== undefined) {
    serializedNames += ' ' + next.name
    next = next.next
  }
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('style', {
      [`data-emotion-${cache.key}`]: serializedNames,
      dangerouslySetInnerHTML: { __html: rules },
      nonce: cache.sheet.nonce,
      key: 1
    }),
    ele
  )
})

const suite = new Benchmark.Suite('ssr', {
  onError: event => {
    console.log(event.target.error)
  },
  onStart: () => {
    console.log('\nStarting benchmarks...')
  }
})

suite
  .add('styled', () => {
    renderToString(React.createElement(Triangle, { s: 100, x: 0, y: 0 }))
  })
  .add('css prop', () => {
    renderToString(React.createElement(CssPropTriangle, { s: 100, x: 0, y: 0 }))
  })
  .add('css prop compat', () => {
    let cache = createCache({ key: '.' })
    createEmotionServer(cache).renderStylesToString(
      renderToString(
        React.createElement(
          CacheProvider,
          { value: cache },
          React.createElement(CssPropTriangle, { s: 100, x: 0, y: 0 })
        )
      )
    )
  })
  .add('css func', () => {
    renderStylesToString(
      renderToString(
        React.createElement(CssFuncTriangle, { s: 100, x: 0, y: 0 })
      )
    )
  })
  .add('experiment', () => {
    let cache = createCache({ key: '.' })
    renderToString(
      React.createElement(
        CacheProvider,
        { value: cache },
        React.createElement(ExperimentTriangle, { s: 100, x: 0, y: 0 })
      )
    )
  })
  .add('styled with random', () => {
    renderToString(
      React.createElement(Triangle, {
        s: 100,
        x: 0,
        y: 0,
        random: Math.random()
      })
    )
  })
  .add('css prop with random', () => {
    renderToString(
      React.createElement(CssPropTriangle, {
        s: 100,
        x: 0,
        y: 0,
        random: Math.random()
      })
    )
  })
  .add('css prop compat with random', () => {
    let cache = createCache({ key: '.' })
    createEmotionServer(cache).renderStylesToString(
      renderToString(
        React.createElement(
          CacheProvider,
          { value: cache },
          React.createElement(CssPropTriangle, {
            s: 100,
            x: 0,
            y: 0,
            random: Math.random()
          })
        )
      )
    )
  })
  .add('css func with random', () => {
    renderStylesToString(
      renderToString(
        React.createElement(CssFuncTriangle, {
          s: 100,
          x: 0,
          y: 0,
          random: Math.random()
        })
      )
    )
  })
  .add('experiment with random', () => {
    let cache = createCache({ key: '.' })
    renderToString(
      React.createElement(
        CacheProvider,
        { value: cache },
        React.createElement(ExperimentTriangle, {
          s: 100,
          x: 0,
          y: 0,
          random: Math.random()
        })
      )
    )
  })
  .on('cycle', event => {
    console.log(String(event.target))
  })
  .run()
