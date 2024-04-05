import { SuggestionOptions } from '@tiptap/suggestion'
import { beginsWith, searchInAny } from 'common/util/parse'
import { EmojiList } from './emoji-list'
import { invertBy, orderBy } from 'lodash'
import shortcodes from './github-shortcodes.json' // from https://api.github.com/emojis
import { PluginKey } from 'prosemirror-state'
import { ENV_CONFIG } from 'common/envs/constants'
import { makeMentionRender } from '../user-mention/mention-suggestion'

type Suggestion = Omit<SuggestionOptions, 'editor'>

export interface EmojiData {
  shortcodes: string[]
  character: string
  codePoint: string
  svgPath?: string
}

// first 100 most popular emoji from https://home.unicode.org/emoji/emoji-frequency/
const ranking =
  '😂❤️🤣👍😭🙏😘🥰😍😊🎉😁💕🥺😅🔥☺️🤦♥️🤷🙄😆🤗😉🎂🤔👏🙂😳🥳😎👌💜😔💪✨💖👀😋😏😢👉💗😩💯🌹💞🎈💙😃😡💐😜🙈🤞😄🤤🙌🤪❣️😀💋💀👇💔😌💓🤩🙃😬😱😴🤭😐🌞😒😇🌸😈🎶✌️🎊🥵😞💚☀️🖤💰😚👑🎁💥🙋☹️😑🥴👈💩✅'

const rank = (c: string) => {
  const r = ranking.indexOf(c)
  return r < 0 ? 101 : r
}

const emojiArr: EmojiData[] = Object.entries(invertBy(shortcodes)).map(
  ([codePoint, shortcodes]) => ({
    codePoint,
    shortcodes,
    character: String.fromCodePoint(
      ...codePoint
        .split(' ')
        .flatMap((s) => [Number(`0x${s}`), 0x200d]) // interleave zero-width joiner
        .slice(0, -1) // remove last joiner
    ),
  })
)

emojiArr.push({
  codePoint: '2133',
  svgPath: '/mana.svg',
  shortcodes: ['mana', 'm$'],
  character: ENV_CONFIG.moneyMoniker,
})
// emojiArr.push({
//   codePoint: '2133',
//   shortcodes: ['mana', 'm$'],
//   character: ENV_CONFIG.moneyMoniker,
// })

// copied from mention-suggestion.ts, which is copied from https://tiptap.dev/api/nodes/mention#usage
export const emojiSuggestion: Suggestion = {
  char: ':',
  pluginKey: new PluginKey('emoji'),
  allowedPrefixes: [' '],
  items: async ({ query }) => {
    const items = emojiArr.filter((item) =>
      searchInAny(query, ...item.shortcodes)
    )
    return orderBy(
      items,
      [
        (item) => item.shortcodes.some((s) => beginsWith(s, query)),
        (item) => rank(item.character),
      ],
      ['desc', 'asc']
    ).slice(0, 5)
  },

  render: makeMentionRender(EmojiList),
  command: ({ editor, range, props }) => {
    if (!!props.svgPath) {
      // Create an image element for the SVG
      const imgNode = document.createElement('img')
      imgNode.src = props.svgPath
      imgNode.alt = props.shortcodes[0]
      imgNode.style.height = '1em !important'
      imgNode.style.width = '1em !important'

      // Convert the image node to a string
      const tempDiv = document.createElement('div')
      tempDiv.appendChild(imgNode)
      const imgHtml = tempDiv.innerHTML

      editor
        .chain()
        .focus()
        .insertContentAt(range, imgHtml + ' ')
        .run()
    } else {
      // Handle Unicode emojis as before
      editor
        .chain()
        .focus()
        .insertContentAt(range, props.character + ' ')
        .run()
    }
  },
}
