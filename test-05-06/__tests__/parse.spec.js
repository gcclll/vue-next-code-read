import { baseParse } from '../parse.js'
import { NodeTypes } from '../ast.js'
import { ErrorCodes } from '../error.js'

describe('compiler: parse', () => {
  describe('Text', () => {
    test('simple text', () => {
      // ...
      const ast = baseParse('some text')
      const text = ast.children[0]

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some text',
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 9, line: 1, column: 10 },
          source: 'some text'
        }
      })
    })

    test('simple text with invalid end tag', () => {
      const onError = jest.fn()
      const ast = baseParse('some text</div>', {
        onError
      })
      const text = ast.children[0]

      expect(onError).toBeCalled()
      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some text',
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 9, line: 1, column: 10 },
          source: 'some text'
        }
      })
    })

    test('text with interpolation', () => {
      const ast = baseParse('some {{ foo + bar }} text')
      const text1 = ast.children[0],
        text2 = ast.children[2]

      expect(text1).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some ',
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          source: 'some ',
          end: { offset: 5, line: 1, column: 6 }
        }
      })

      expect(text2).toStrictEqual({
        type: NodeTypes.TEXT,
        content: ' text',
        loc: {
          start: { offset: 20, line: 1, column: 21 },
          source: ' text',
          end: { offset: 25, line: 1, column: 26 }
        }
      })
    }) // text with interpolation

    test('text with interpolation which has `<`', () => {
      const ast = baseParse('some {{ a<b && c>d }} text')
      const text1 = ast.children[0],
        text2 = ast.children[2]

      expect(text1).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some ',
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 5, line: 1, column: 6 },
          source: 'some '
        }
      })

      expect(text2).toStrictEqual({
        type: NodeTypes.TEXT,
        content: ' text',
        loc: {
          start: { offset: 21, line: 1, column: 22 },
          end: { offset: 26, line: 1, column: 27 },
          source: ' text'
        }
      })
    }) // text with interpolation which has `<`

    test('text with mix of tags and interpolations', () => {
      const ast = baseParse('some <span>{{ foo < bar + foo }} text</span>')
      const text1 = ast.children[0],
        text2 = ast.children[1].children[1]

      expect(text1).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'some ',
        loc: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 6, offset: 5 },
          source: 'some '
        }
      })

      expect(text2).toStrictEqual({
        type: NodeTypes.TEXT,
        content: ' text',
        loc: {
          start: {
            line: 1,
            column: 33,
            offset: 32 // `some <span>{{ foo < bar + foo }} `.length - 1
          },
          end: {
            line: 1,
            column: 38,
            offset: 37 // 32 + `text<`.length
          },
          source: ' text'
        }
      })
    }) // text with mix of tags and interpolations

    test('lonly "<" don\'t separate nodes', () => {
      const ast = baseParse('a < b', {
        onError: (err) => {
          if (err.code !== ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME) {
            throw err
          }
        }
      })
      const text = ast.children[0]

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'a < b',
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 5, line: 1, column: 6 },
          source: 'a < b'
        }
      }) // lonly "<" don\'t separate nodes
    })
  })
})
