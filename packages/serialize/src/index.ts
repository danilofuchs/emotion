import hashString from '@emotion/hash'
import unitless from '@emotion/unitless'
import memoize from '@emotion/memoize'
import { RegisteredCache, SerializedStyles } from '@emotion/utils'
import * as CSS from 'csstype'

type Props = Record<string, unknown>
type Cursor = {
  name: string
  styles: string
  next?: Cursor
}

export type CSSProperties = CSS.PropertiesFallback<number | string>
export type CSSPropertiesWithMultiValues = {
  [K in keyof CSSProperties]:
    | CSSProperties[K]
    | Array<Extract<CSSProperties[K], string>>
}

export type CSSPseudos = { [K in CSS.Pseudos]?: CSSObject }

export interface ArrayCSSInterpolation extends Array<CSSInterpolation> {}

export type InterpolationPrimitive =
  | null
  | undefined
  | boolean
  | number
  | string
  | ComponentSelector
  | Keyframes
  | SerializedStyles
  | CSSObject

export type CSSInterpolation = InterpolationPrimitive | ArrayCSSInterpolation

export interface CSSOthersObject {
  [propertiesName: string]: CSSInterpolation
}

export interface CSSObject
  extends CSSPropertiesWithMultiValues,
    CSSPseudos,
    CSSOthersObject {}

export interface ComponentSelector {
  __emotion_styles: any
}

export type Keyframes = {
  name: string
  styles: string
  anim: number
  toString: () => string
} & string

export interface ArrayInterpolation<Props>
  extends Array<Interpolation<Props>> {}

export interface FunctionInterpolation<Props> {
  (props: Props): Interpolation<Props>
}

export type Interpolation<Props> =
  | InterpolationPrimitive
  | ArrayInterpolation<Props>
  | FunctionInterpolation<Props>

const ILLEGAL_ESCAPE_SEQUENCE_ERROR = `You have illegal escape sequence in your template literal, most likely inside content's property value.
Because you write your CSS inside a JavaScript string you actually have to do double escaping, so for example "content: '\\00d7';" should become "content: '\\\\00d7';".
You can read more about this here:
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#ES2018_revision_of_illegal_escape_sequences`

const UNDEFINED_AS_OBJECT_KEY_ERROR =
  "You have passed in falsy value as style object's key (can happen when in example you pass unexported component as computed key)."

let hyphenateRegex = /[A-Z]|^ms/g
let animationRegex = /_EMO_([^_]+?)_([^]*?)_EMO_/g

const isCustomProperty = (property: string) => property.charCodeAt(1) === 45
const isProcessableValue = <Props>(value: Interpolation<Props>) =>
  value != null && typeof value !== 'boolean'

const isComponentSelector = (
  interpolation: any
): interpolation is ComponentSelector =>
  interpolation !== null &&
  typeof interpolation === 'object' &&
  '__emotion_styles' in interpolation

const isKeyframes = (interpolation: any): interpolation is Keyframes =>
  interpolation !== null &&
  typeof interpolation === 'object' &&
  'anim' in interpolation &&
  interpolation.anim === 1

const isSerializedStyles = (
  interpolation: any
): interpolation is SerializedStyles =>
  interpolation !== null &&
  typeof interpolation === 'object' &&
  'styles' in interpolation &&
  interpolation.styles !== undefined

const processStyleName = /* #__PURE__ */ memoize((styleName /*: string */) =>
  isCustomProperty(styleName)
    ? styleName
    : styleName.replace(hyphenateRegex, '-$&').toLowerCase()
)

let processStyleValue = (
  key: string,
  value: string | number
): string | number => {
  switch (key) {
    case 'animation':
    case 'animationName': {
      if (typeof value === 'string') {
        return value.replace(animationRegex, (match, p1, p2) => {
          cursor = {
            name: p1,
            styles: p2,
            next: cursor
          }
          return p1
        })
      }
    }
  }

  if (
    unitless[key as keyof typeof unitless] !== 1 &&
    !isCustomProperty(key) &&
    typeof value === 'number' &&
    value !== 0
  ) {
    return value + 'px'
  }
  return value
}

if (process.env.NODE_ENV !== 'production') {
  let contentValuePattern =
    /(attr|counters?|url|(((repeating-)?(linear|radial))|conic)-gradient)\(|(no-)?(open|close)-quote/
  let contentValues = ['normal', 'none', 'initial', 'inherit', 'unset']

  let oldProcessStyleValue = processStyleValue

  let msPattern = /^-ms-/
  let hyphenPattern = /-(.)/g

  let hyphenatedCache: Record<string, boolean | undefined> = {}

  processStyleValue = (key: string, value: string | number) => {
    if (key === 'content') {
      if (
        typeof value !== 'string' ||
        (contentValues.indexOf(value) === -1 &&
          !contentValuePattern.test(value) &&
          (value.charAt(0) !== value.charAt(value.length - 1) ||
            (value.charAt(0) !== '"' && value.charAt(0) !== "'")))
      ) {
        throw new Error(
          `You seem to be using a value for 'content' without quotes, try replacing it with \`content: '"${value}"'\``
        )
      }
    }

    const processed = oldProcessStyleValue(key, value)

    if (
      processed !== '' &&
      !isCustomProperty(key) &&
      key.indexOf('-') !== -1 &&
      hyphenatedCache[key] === undefined
    ) {
      hyphenatedCache[key] = true
      console.error(
        `Using kebab-case for css properties in objects is not supported. Did you mean ${key
          .replace(msPattern, 'ms-')
          .replace(hyphenPattern, (str, char) => char.toUpperCase())}?`
      )
    }

    return processed
  }
}

function handleInterpolation<Props>(
  mergedProps: Props | undefined,
  registered: RegisteredCache | undefined,
  interpolation: Interpolation<Props> | TemplateStringsArray
): string | number {
  if (interpolation == null) {
    return ''
  }
  if (isComponentSelector(interpolation)) {
    if (
      process.env.NODE_ENV !== 'production' &&
      interpolation.toString() === 'NO_COMPONENT_SELECTOR'
    ) {
      throw new Error(
        'Component selectors can only be used in conjunction with @emotion/babel-plugin.'
      )
    }
  }

  switch (typeof interpolation) {
    case 'boolean': {
      return ''
    }
    case 'object': {
      if (isKeyframes(interpolation)) {
        cursor = {
          name: interpolation.name,
          styles: interpolation.styles,
          next: cursor
        }

        return interpolation.name
      }
      if (isSerializedStyles(interpolation)) {
        let next = interpolation.next
        if (next !== undefined) {
          // not the most efficient thing ever but this is a pretty rare case
          // and there will be very few iterations of this generally
          while (next !== undefined) {
            cursor = {
              name: next.name,
              styles: next.styles,
              next: cursor
            }
            next = next.next
          }
        }
        let styles = `${interpolation.styles};`
        if (
          process.env.NODE_ENV !== 'production' &&
          interpolation.map !== undefined
        ) {
          styles += interpolation.map
        }

        return styles
      }

      return createStringFromObject(mergedProps, registered, interpolation)
    }
    case 'function': {
      if (mergedProps !== undefined) {
        let previousCursor = cursor
        let result = interpolation(mergedProps)
        cursor = previousCursor

        return handleInterpolation(mergedProps, registered, result)
      } else if (process.env.NODE_ENV !== 'production') {
        console.error(
          'Functions that are interpolated in css calls will be stringified.\n' +
            'If you want to have a css call based on props, create a function that returns a css call like this\n' +
            'let dynamicStyle = (props) => css`color: ${props.color}`\n' +
            'It can be called directly with props or interpolated in a styled call like this\n' +
            "let SomeComponent = styled('div')`${dynamicStyle}`"
        )
      }
      break
    }
    case 'string':
      if (process.env.NODE_ENV !== 'production') {
        const matched: string[] = []
        const replaced = interpolation.replace(
          animationRegex,
          (_match, _p1, p2) => {
            const fakeVarName = `animation${matched.length}`
            matched.push(
              `const ${fakeVarName} = keyframes\`${p2.replace(
                /^@keyframes animation-\w+/,
                ''
              )}\``
            )
            return `\${${fakeVarName}}`
          }
        )
        if (matched.length) {
          console.error(
            `\`keyframes\` output got interpolated into plain string, please wrap it with \`css\`.

Instead of doing this:

${[...matched, `\`${replaced}\``].join('\n')}

You should wrap it with \`css\` like this:

css\`${replaced}\``
          )
        }
      }
      break
  }

  // finalize string values (regular strings and functions interpolated into css calls)
  const asString = interpolation as string
  if (registered == null) {
    return asString
  }
  const cached = registered[asString]
  return cached !== undefined ? cached : asString
}

function createStringFromObject<Props>(
  mergedProps: Props | undefined,
  registered: RegisteredCache | undefined,
  obj:
    | ArrayInterpolation<Props>
    | CSSObject
    | ComponentSelector
    | TemplateStringsArray
): string {
  let string = ''

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      string += `${handleInterpolation(mergedProps, registered, obj[i])};`
    }
  } else {
    for (let key in obj) {
      let value = (obj as any)[key] as Interpolation<Props>
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'symbol'
      ) {
        if (registered != null && registered[value] !== undefined) {
          string += `${key}{${registered[value]}}`
        } else if (isProcessableValue(value)) {
          string += `${processStyleName(key)}:${processStyleValue(key, value)};`
        }
      } else {
        if (
          key === 'NO_COMPONENT_SELECTOR' &&
          process.env.NODE_ENV !== 'production'
        ) {
          throw new Error(
            'Component selectors can only be used in conjunction with @emotion/babel-plugin.'
          )
        }
        if (
          Array.isArray(value) &&
          typeof value[0] === 'string' &&
          (registered == null || registered[value[0]] === undefined)
        ) {
          for (let i = 0; i < value.length; i++) {
            if (isProcessableValue(value[i])) {
              string += `${processStyleName(key)}:${processStyleValue(
                key,
                value[i] as string | number
              )};`
            }
          }
        } else {
          const interpolated = handleInterpolation(
            mergedProps,
            registered,
            value
          )
          switch (key) {
            case 'animation':
            case 'animationName': {
              string += `${processStyleName(key)}:${interpolated};`
              break
            }
            default: {
              if (
                process.env.NODE_ENV !== 'production' &&
                key === 'undefined'
              ) {
                console.error(UNDEFINED_AS_OBJECT_KEY_ERROR)
              }
              string += `${key}{${interpolated}}`
            }
          }
        }
      }
    }
  }

  return string
}

let labelPattern = /label:\s*([^\s;\n{]+)\s*(;|$)/g

let sourceMapPattern: RegExp | undefined
if (process.env.NODE_ENV !== 'production') {
  sourceMapPattern =
    /\/\*#\ssourceMappingURL=data:application\/json;\S+\s+\*\//g
}

// this is the cursor for keyframes
// keyframes are stored on the SerializedStyles object as a linked list
let cursor: Cursor | undefined

export const serializeStyles = function <Props>(
  args: Array<TemplateStringsArray | Interpolation<Props>>,
  registered: RegisteredCache,
  mergedProps?: Props
): SerializedStyles {
  if (
    args.length === 1 &&
    !Array.isArray(args[0]) &&
    isSerializedStyles(args[0])
  ) {
    return args[0] as SerializedStyles
  }
  let stringMode = true
  let styles = ''

  cursor = undefined
  let strings = args[0] as TemplateStringsArray
  if (strings == null || strings.raw === undefined) {
    stringMode = false
    styles += handleInterpolation(mergedProps, registered, strings)
  } else {
    if (process.env.NODE_ENV !== 'production' && strings[0] === undefined) {
      console.error(ILLEGAL_ESCAPE_SEQUENCE_ERROR)
    }
    styles += strings[0]
  }
  // we start at 1 since we've already handled the first arg
  for (let i = 1; i < args.length; i++) {
    styles += handleInterpolation(mergedProps, registered, args[i])
    if (stringMode) {
      if (process.env.NODE_ENV !== 'production' && strings[i] === undefined) {
        console.error(ILLEGAL_ESCAPE_SEQUENCE_ERROR)
      }
      styles += strings[i]
    }
  }
  let sourceMap

  if (process.env.NODE_ENV !== 'production' && sourceMapPattern !== undefined) {
    styles = styles.replace(sourceMapPattern, match => {
      sourceMap = match
      return ''
    })
  }

  // using a global regex with .exec is stateful so lastIndex has to be reset each time
  labelPattern.lastIndex = 0
  let identifierName = ''

  let match
  // https://esbench.com/bench/5b809c2cf2949800a0f61fb5
  while ((match = labelPattern.exec(styles)) !== null) {
    identifierName += '-' + match[1]
  }

  let name = hashString(styles) + identifierName

  if (process.env.NODE_ENV !== 'production') {
    return {
      name,
      styles,
      map: sourceMap,
      next: cursor,
      toString() {
        return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."
      }
    }
  }
  return {
    name,
    styles,
    next: cursor
  }
}
