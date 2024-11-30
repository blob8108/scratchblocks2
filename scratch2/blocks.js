import {
  Label,
  Icon,
  Input,
  Block,
  Comment,
  Glow,
  Script,
  Document,
  extensions,
  movedExtensions,
  aliasExtensions,
} from "../syntax/index.js"

import SVG from "./draw.js"

import style from "./style.js"
const {
  defaultFontFamily,
  makeStyle,
  makeIcons,
  darkRect,
  bevelFilter,
  darkFilter,
} = style

export class LabelView {
  constructor(label) {
    Object.assign(this, label)

    this.el = null
    this.height = 12
    this.metrics = null
    this.x = 0
  }

  get isLabel() {
    return true
  }

  draw() {
    return this.el
  }

  get width() {
    return this.metrics.width
  }

  measure() {
    const value = this.value
    const cls = `sb-${this.cls}`
    this.el = SVG.text(0, 10, value, {
      class: `sb-label ${cls}`,
    })

    let cache = LabelView.metricsCache[cls]
    if (!cache) {
      cache = LabelView.metricsCache[cls] = Object.create(null)
    }

    if (Object.hasOwnProperty.call(cache, value)) {
      this.metrics = cache[value]
    } else {
      const font = /comment-label/.test(this.cls)
        ? "bold 12px Helvetica, Arial, DejaVu Sans, sans-serif"
        : /literal/.test(this.cls)
          ? `normal 9px ${defaultFontFamily}`
          : `bold 10px ${defaultFontFamily}`
      this.metrics = cache[value] = LabelView.measure(value, font)
      // TODO: word-spacing? (fortunately it seems to have no effect!)
    }
  }

  static measure(value, font) {
    const context = LabelView.measuring
    context.font = font
    const textMetrics = context.measureText(value)
    const width = (textMetrics.width + 0.5) | 0
    return { width: width }
  }
}

LabelView.metricsCache = {}
LabelView.toMeasure = []

class IconView {
  constructor(icon) {
    Object.assign(this, icon)

    const info = IconView.icons[this.name]
    if (!info) {
      throw new Error(`no info for icon: ${this.name}`)
    }
    Object.assign(this, info)
  }

  get isIcon() {
    return true
  }

  draw() {
    return SVG.symbol(`#${this.name}`, {
      width: this.width,
      height: this.height,
    })
  }

  static get icons() {
    return {
      greenFlag: { width: 20, height: 21, dy: -2 },
      stopSign: { width: 20, height: 20 },
      turnLeft: { width: 15, height: 12, dy: +1 },
      turnRight: { width: 15, height: 12, dy: +1 },
      loopArrow: { width: 14, height: 11 },
      addInput: { width: 4, height: 8 },
      delInput: { width: 4, height: 8 },
      list: { width: 12, height: 14 },
    }
  }
}

class InputView {
  constructor(input) {
    Object.assign(this, input)
    if (input.label) {
      this.label = newView(input.label)
    }

    this.x = 0
  }

  measure() {
    if (this.hasLabel) {
      this.label.measure()
    }
  }

  static get shapes() {
    return {
      string: SVG.rect,
      number: SVG.roundedRect,
      "number-dropdown": SVG.roundedRect,
      color: SVG.rect,
      dropdown: SVG.rect,

      boolean: SVG.pointedRect,
      stack: SVG.stackRect,
      reporter: SVG.roundedRect,
    }
  }

  draw(parent) {
    let w
    let label
    if (this.hasLabel) {
      label = this.label.draw()
      w = Math.max(
        14,
        this.label.width +
          (this.shape === "string" || this.shape === "number-dropdown" ? 6 : 9),
      )
    } else {
      w = this.isInset ? 30 : this.isColor ? 13 : null
    }
    if (this.hasArrow) {
      w += 10
    }
    this.width = w

    const h = (this.height = this.isRound || this.isColor ? 13 : 14)

    let el = InputView.shapes[this.shape](w, h)
    if (this.isColor) {
      SVG.setProps(el, {
        fill: this.value,
      })
    } else if (this.isDarker) {
      el = darkRect(w, h, parent.info.category, el)
      if (parent.info.color) {
        SVG.setProps(el, {
          fill: parent.info.color,
        })
      }
    }

    const result = SVG.group([
      SVG.setProps(el, {
        class: `sb-input sb-input-${this.shape}`,
      }),
    ])
    if (this.hasLabel) {
      const x = this.isRound ? 5 : 4
      result.appendChild(SVG.move(x, 0, label))
    }
    if (this.hasArrow) {
      const y = this.shape === "dropdown" ? 5 : 4
      result.appendChild(
        SVG.move(
          w - 10,
          y,
          SVG.polygon({
            points: [7, 0, 3.5, 4, 0, 0],
            fill: "#000",
            opacity: "0.6",
          }),
        ),
      )
    }
    return result
  }
}

class BlockView {
  constructor(block) {
    Object.assign(this, block)
    this.children = block.children.map(newView)
    this.comment = this.comment ? newView(this.comment) : null

    if (
      Object.prototype.hasOwnProperty.call(aliasExtensions, this.info.category)
    ) {
      // handle aliases first
      this.info.category = aliasExtensions[this.info.category]
    }
    if (
      Object.prototype.hasOwnProperty.call(movedExtensions, this.info.category)
    ) {
      this.info.category = movedExtensions[this.info.category]
    } else if (
      Object.prototype.hasOwnProperty.call(extensions, this.info.category)
    ) {
      this.info.category = "extension"
    }

    this.x = 0
    this.width = null
    this.height = null
    this.firstLine = null
    this.innerWidth = null
  }

  get isBlock() {
    return true
  }

  measure() {
    for (const child of this.children) {
      if (child.measure) {
        child.measure()
      }
    }
    if (this.comment) {
      this.comment.measure()
    }
  }

  static get shapes() {
    return {
      stack: SVG.stackRect,
      "c-block": SVG.stackRect,
      "if-block": SVG.stackRect,
      celse: SVG.stackRect,
      cend: SVG.stackRect,

      cap: SVG.capRect,
      reporter: SVG.roundedRect,
      boolean: SVG.pointedRect,
      hat: SVG.hatRect,
      cat: SVG.hatRect,
      "define-hat": SVG.procHatRect,
      ring: SVG.roundedRect,
    }
  }

  drawSelf(w, h, lines) {
    // mouths
    if (lines.length > 1) {
      return SVG.mouthRect(w, h, this.isFinal, lines, {
        class: `sb-${this.info.category} sb-bevel`,
      })
    }

    // outlines
    if (this.info.shape === "outline") {
      return SVG.setProps(SVG.stackRect(w, h), {
        class: "sb-outline",
      })
    }

    // rings
    if (this.isRing) {
      const child = this.children[0]
      // We use isStack for InputView; isBlock for BlockView; isScript for ScriptView.
      if (child && (child.isStack || child.isBlock || child.isScript)) {
        const shape = child.isScript
          ? "stack"
          : child.isStack
            ? child.shape
            : child.info.shape
        return SVG.ringRect(w, h, child.y, child.width, child.height, shape, {
          class: `sb-${this.info.category} sb-bevel`,
        })
      }
    }

    const func = BlockView.shapes[this.info.shape]
    if (!func) {
      throw new Error(`no shape func: ${this.info.shape}`)
    }
    return func(w, h, {
      class: `sb-${this.info.category} sb-bevel`,
    })
  }

  minDistance(child) {
    if (this.isBoolean) {
      return child.isReporter
        ? (4 + child.height / 4) | 0
        : child.isLabel
          ? (5 + child.height / 2) | 0
          : child.isBoolean || child.shape === "boolean"
            ? 5
            : (2 + child.height / 2) | 0
    }
    if (this.isReporter) {
      return (child.isInput && child.isRound) ||
        ((child.isReporter || child.isBoolean) && !child.hasScript)
        ? 0
        : child.isLabel
          ? (2 + child.height / 2) | 0
          : (-2 + child.height / 2) | 0
    }
    return 0
  }

  static get padding() {
    return {
      hat: [15, 6, 2],
      cat: [15, 6, 2],
      "define-hat": [21, 8, 9],
      reporter: [3, 4, 1],
      boolean: [3, 4, 2],
      cap: [6, 6, 2],
      "c-block": [3, 6, 2],
      "if-block": [3, 6, 2],
      ring: [4, 4, 2],
      null: [4, 6, 2],
    }
  }

  draw() {
    const isDefine = this.info.shape === "define-hat"
    let children = this.children

    const hasOutlineChild = children.find(child => child.isOutline)

    const padding = BlockView.padding[this.info.shape] || BlockView.padding.null
    let pt = padding[0]
    const px = padding[1]
    const pb = padding[2]

    let y = 0
    const Line = function (y) {
      this.y = y
      this.width = 0
      this.height = y ? 13 : 16
      this.children = []
    }

    let innerWidth = 0
    let scriptWidth = 0
    let line = new Line(y)
    const pushLine = isLast => {
      if (lines.length === 0) {
        line.height += pt + pb
      } else {
        line.height += isLast ? 0 : +2
        line.y -= 1
      }
      y += line.height
      lines.push(line)
    }

    if (this.info.isRTL) {
      let start = 0
      const flip = () => {
        children = children
          .slice(0, start)
          .concat(children.slice(start, i).reverse())
          .concat(children.slice(i))
      }
      let i
      for (i = 0; i < children.length; i++) {
        if (children[i].isScript) {
          flip()
          start = i + 1
        }
      }
      if (start < i) {
        flip()
      }
    }

    const lines = []
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      child.el = child.draw(this)

      if (child.isScript && this.isCommand) {
        this.hasScript = true
        pushLine()
        child.y = y
        lines.push(child)
        scriptWidth = Math.max(scriptWidth, Math.max(1, child.width))
        child.height = Math.max(12, child.height) + 3
        y += child.height
        line = new Line(y)
      } else if (child.isArrow) {
        line.children.push(child)
      } else {
        const cmw = i > 0 ? 30 : 0 // 27
        const md = this.isCommand ? 0 : this.minDistance(child)
        const mw = this.isCommand
          ? child.isBlock || child.isInput
            ? cmw
            : 0
          : md
        if (mw && !lines.length && line.width < mw - px) {
          line.width = mw - px
        }
        child.x = line.width
        line.width += child.width
        innerWidth = Math.max(innerWidth, line.width + Math.max(0, md - px))
        line.width += 4
        if (!child.isLabel) {
          line.height = Math.max(line.height, child.height)
        }
        line.children.push(child)
      }
    }
    pushLine(true)

    innerWidth = Math.max(
      innerWidth + px * 2,
      this.isHat || this.hasScript
        ? 83
        : this.isCommand || this.isOutline || this.isRing
          ? 39
          : 20,
    )
    this.height = y
    this.width = scriptWidth
      ? Math.max(innerWidth, 15 + scriptWidth)
      : innerWidth
    if (isDefine) {
      let p = Math.min(26, (3.5 + 0.13 * innerWidth) | 0) - 18
      if (!hasOutlineChild) p += 6
      this.height += p
      pt += 2 * p
    }
    this.firstLine = lines[0]
    this.innerWidth = innerWidth

    const objects = []

    for (const line of lines) {
      if (line.isScript) {
        objects.push(SVG.move(15, line.y, line.el))
        continue
      }

      const h = line.height

      for (const child of line.children) {
        if (child.isArrow) {
          objects.push(SVG.move(innerWidth - 15, this.height - 3, child.el))
          continue
        }

        let y = pt + (h - child.height - pt - pb) / 2 - 1
        if (isDefine && child.isLabel) {
          y += 3
        } else if (child.isIcon) {
          y += child.dy | 0
        }
        if (this.isRing) {
          child.y = (line.y + y) | 0
          if (child.isInset) {
            continue
          }
        }
        objects.push(SVG.move(px + child.x, (line.y + y) | 0, child.el))

        if (child.diff === "+") {
          const ellipse = SVG.insEllipse(child.width, child.height)
          objects.push(SVG.move(px + child.x, (line.y + y) | 0, ellipse))
        }
      }
    }

    const el = this.drawSelf(innerWidth, this.height, lines)
    objects.splice(0, 0, el)
    if (this.info.color) {
      SVG.setProps(el, {
        fill: this.info.color,
      })
    }

    if (isDefine && !hasOutlineChild) {
      const cap = el.querySelector(".sb-define-hat-cap")
      if (cap) {
        SVG.setProps(cap, {
          stroke: this.info.color,
          fill: "rgba(255, 255, 255, 0.15)",
          class: `sb-${this.info.category}`,
        })
      }
    }

    return SVG.group(objects)
  }
}

class CommentView {
  constructor(comment) {
    Object.assign(this, comment)
    this.label = newView(comment.label)

    this.width = null
  }

  get isComment() {
    return true
  }

  static get lineLength() {
    return 12
  }

  get height() {
    return 20
  }

  measure() {
    this.label.measure()
  }

  draw() {
    const labelEl = this.label.draw()

    this.width = this.label.width + 16
    return SVG.group([
      SVG.commentLine(this.hasBlock ? CommentView.lineLength : 0, 6),
      SVG.commentRect(this.width, this.height, {
        class: "sb-comment",
      }),
      SVG.move(8, 4, labelEl),
    ])
  }
}

class GlowView {
  constructor(glow) {
    Object.assign(this, glow)
    this.child = newView(glow.child)

    this.width = null
    this.height = null
    this.y = 0
  }

  get isGlow() {
    return true
  }

  measure() {
    this.child.measure()
  }

  drawSelf() {
    const c = this.child
    let el
    const w = this.width
    const h = this.height - 1
    if (c.isScript) {
      if (!c.isEmpty && c.blocks[0].isHat) {
        el = SVG.hatRect(w, h)
      } else if (c.isFinal) {
        el = SVG.capRect(w, h)
      } else {
        el = SVG.stackRect(w, h)
      }
    } else {
      el = c.drawSelf(w, h, [])
    }
    return SVG.setProps(el, {
      class: "sb-diff sb-diff-ins",
    })
  }
  // TODO how can we always raise Glows above their parents?

  draw() {
    const c = this.child
    const el = c.isScript ? c.draw(true) : c.draw()

    this.width = c.width
    this.height = (c.isBlock && c.firstLine.height) || c.height

    // encircle
    return SVG.group([el, this.drawSelf()])
  }
}

class ScriptView {
  constructor(script) {
    Object.assign(this, script)
    this.blocks = script.blocks.map(newView)

    this.y = 0
  }

  get isScript() {
    return true
  }

  measure() {
    for (const block of this.blocks) {
      block.measure()
    }
  }

  draw(inside) {
    const children = []
    let y = 0
    this.width = 0
    for (const block of this.blocks) {
      const x = inside ? 0 : 2
      const child = block.draw()
      children.push(SVG.move(x, y, child))
      this.width = Math.max(this.width, block.width)

      const diff = block.diff
      if (diff === "-") {
        const dw = block.width
        const dh = block.firstLine.height || block.height
        children.push(SVG.move(x, y + dh / 2 + 1, SVG.strikethroughLine(dw)))
        this.width = Math.max(this.width, block.width)
      }

      y += block.height

      const comment = block.comment
      if (comment) {
        const line = block.firstLine
        const cx = block.innerWidth + 2 + CommentView.lineLength
        const cy = y - block.height + line.height / 2
        const el = comment.draw()
        children.push(SVG.move(cx, cy - comment.height / 2, el))
        this.width = Math.max(this.width, cx + comment.width)
      }
    }
    this.height = y
    if (!inside && !this.isFinal) {
      this.height += 3
    }
    const lastBlock = this.blocks[this.blocks.length - 1]
    if (!inside && lastBlock.isGlow) {
      this.height += 2 // TODO unbreak this
    }
    return SVG.group(children)
  }
}

class DocumentView {
  constructor(doc, options) {
    Object.assign(this, doc)
    this.scripts = doc.scripts.map(newView)

    this.width = null
    this.height = null
    this.el = null
    this.defs = null
    this.scale = options.scale
  }

  measure() {
    this.scripts.forEach(script => script.measure())
  }

  render(cb) {
    if (typeof cb === "function") {
      throw new Error("render() no longer takes a callback")
    }

    // measure strings
    this.measure()

    // TODO: separate layout + render steps.
    // render each script
    let width = 0
    let height = 0
    const elements = []
    for (const script of this.scripts) {
      if (height) {
        height += 10
      }
      script.y = height
      elements.push(SVG.move(0, height, script.draw()))
      height += script.height
      width = Math.max(width, script.width + 4)
    }
    this.width = width
    this.height = height

    // return SVG
    const svg = SVG.newSVG(width, height, this.scale)
    svg.appendChild(
      (this.defs = SVG.withChildren(SVG.el("defs"), [
        bevelFilter("bevelFilter", false),
        bevelFilter("inputBevelFilter", true),
        darkFilter("inputDarkFilter"),
        ...makeIcons(),
      ])),
    )

    svg.appendChild(SVG.group(elements))
    this.el = svg
    return svg
  }

  /* Export SVG image as XML string */
  exportSVGString() {
    if (this.el == null) {
      throw new Error("call draw() first")
    }

    const style = makeStyle()
    this.defs.appendChild(style)
    const xml = new SVG.XMLSerializer().serializeToString(this.el)
    this.defs.removeChild(style)
    return xml
  }

  /* Export SVG image as data URI */
  exportSVG() {
    const xml = this.exportSVGString()
    return `data:image/svg+xml;utf8,${xml.replace(/[#]/g, encodeURIComponent)}`
  }

  toCanvas(cb, exportScale) {
    exportScale = exportScale || 1.0

    const canvas = SVG.makeCanvas()
    canvas.width = Math.max(1, this.width * exportScale * this.scale)
    canvas.height = Math.max(1, this.height * exportScale * this.scale)
    const context = canvas.getContext("2d")

    const image = new Image()
    image.src = this.exportSVG()
    image.onload = () => {
      context.save()
      context.scale(exportScale, exportScale)
      context.drawImage(image, 0, 0)
      context.restore()

      cb(canvas)
    }
  }

  exportPNG(cb, scale) {
    this.toCanvas(canvas => {
      if (URL && URL.createObjectURL && Blob && canvas.toBlob) {
        canvas.toBlob(blob => {
          cb(URL.createObjectURL(blob))
        }, "image/png")
      } else {
        cb(canvas.toDataURL("image/png"))
      }
    }, scale)
  }
}

const viewFor = node => {
  switch (node.constructor) {
    case Label:
      return LabelView
    case Icon:
      return IconView
    case Input:
      return InputView
    case Block:
      return BlockView
    case Comment:
      return CommentView
    case Glow:
      return GlowView
    case Script:
      return ScriptView
    case Document:
      return DocumentView
    default:
      throw new Error(`no view for ${node.constructor.name}`)
  }
}

export const newView = (node, options) => new (viewFor(node))(node, options)
