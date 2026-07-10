# 舒适阅读主题设计

- 日期：2026-07-10
- 状态：已实施并验证
- 候选：稻纸 Light、雾松 Light、藕灰 Light

## 实施结果

- 已在 `src/themes.ts` 注册三套完整主题。
- 已在 `src/i18n.ts` 补充中英文名称。
- 已通过 Svelte 类型检查，以及 Lite、Plus、Web Plus 构建。
- 已验证 Plus 与 Web Plus 的主题切换和刷新恢复。
- 已验证 `390×844` 窄屏菜单无横向溢出，浏览器控制台无新增错误或警告。

## 1. 目标

在保留现有主题和主题持久化行为的前提下，新增三套适合长时间阅读的浅色主题。三套主题都降低纯白背景带来的主观眩光，但不以降低文字对比度换取“柔和感”。

主题定位为“舒适阅读”或“低眩光”，不使用医学意义上的“护眼”宣传。暖色只是视觉偏好；阅读舒适度仍取决于环境照明、屏幕亮度、字号、行高、眩光和休息节奏。

## 2. 设计原则

1. 正文、次级文字、链接、编辑器语法色均以 WCAG 2.2 普通文字 `4.5:1` 为最低目标。
2. 内容背景不用纯白，正文不用纯黑，保留足够的亮度差。
3. 三套主题必须有明确差异：稻纸偏中性暖黄，雾松偏低饱和灰绿，藕灰偏低饱和粉灰。
4. 交互强调色保持克制，但按钮文字、选中态和焦点轮廓必须清晰。
5. `contentOverlay` 使用 `0.92` 不透明度，减少用户背景图对正文辨识度的影响。
6. 保留现有 `paper-light`，不替换、不迁移，避免破坏已保存的主题 ID。

参考资料：

- [W3C WCAG 2.2：Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [American Optometric Association：Computer vision syndrome](https://www.aoa.org/healthy-eyes/eye-and-vision-conditions/computer-vision-syndrome)
- [PubMed：Positive display polarity is particularly advantageous for small character sizes](https://pubmed.ncbi.nlm.nih.gov/25141597/)
- [Cochrane：Blue-light filtering spectacle lenses](https://www.cochrane.org/evidence/CD013244_blue-light-filtering-spectacle-lenses-visual-performance-macular-back-part-eye-protection-and)

## 3. 命名与稳定 ID

| 稳定 ID | 中文名称 | 英文名称 | 定位 |
| --- | --- | --- | --- |
| `rice-paper-light` | 稻纸 Light | Rice Paper Light | 中性暖纸，适合白天长文阅读 |
| `mist-pine-light` | 雾松 Light | Mist Pine Light | 低饱和灰绿，减少黄色倾向 |
| `lotus-gray-light` | 藕灰 Light | Lotus Gray Light | 低饱和粉灰，适合偏暖环境 |

主题列表顺序保持“浅色在前、深色在后”。三套新主题放在现有 `paper-light` 之后、`night-dark` 之前。默认主题仍为 `tea-light`。

## 4. 完整 Token

以下对象覆盖 `ThemeTokens` 的全部字段，可直接作为实施基线。

### 4.1 稻纸 Light

```ts
const ricePaperLight: ThemeTokens = {
  appBg: '#f2efe2',
  appText: '#2b2a24',
  panelBg: '#f7f4e9',
  panelText: '#37352d',
  panelMuted: '#6e6a5d',
  contentBg: '#fbf9f1',
  contentOverlay: 'rgba(251, 249, 241, 0.92)',
  border: '#d7d1c0',
  borderSoft: '#e6e1d4',
  buttonBg: '#fbf9f1',
  buttonHover: '#eee9d9',
  buttonText: '#2b2a24',
  primary: '#7b6a35',
  primaryHover: '#66572b',
  primaryText: '#fffaf0',
  selectedBg: '#e6dfc9',
  selectedText: '#5c4f28',
  segmentedBg: '#ebe6d9',
  activeBg: '#fbf9f1',
  dirtyBg: '#f7e8c5',
  dirtyText: '#725300',
  muted: '#6e6a5d',
  dot: '#9b9688',
  editorBg: '#fbf9f1',
  editorText: '#2b2a24',
  editorGutterBg: '#f1ede2',
  editorGutterText: '#6e6a5d',
  editorCursor: '#7b6a35',
  editorSelection: '#ddd3b8',
  editorLine: '#f1ede1',
  editorKeyword: '#655b24',
  editorHeading: '#6e5f2f',
  editorLink: '#586a38',
  editorString: '#745b16',
  editorComment: '#6e6a5d',
  editorCode: '#814739',
  markdownText: '#2b2a24',
  markdownH1: '#5f532c',
  markdownH2: '#6a5b2d',
  markdownH3: '#586a38',
  markdownH4: '#5d6441',
  markdownH5: '#745b16',
  markdownH6: '#7b5046',
  markdownLink: '#586a38',
  markdownQuoteText: '#625f54',
  markdownQuoteBorder: '#7b6a35',
  markdownCodeBg: '#eae5d7',
  markdownCodeText: '#7b4638',
  markdownPreBg: '#f1ede2',
  markdownTableHeaderBg: '#ece6d5',
  markdownRule: '#dcd6c6',
  dropBg: 'rgba(230, 223, 201, 0.90)'
};
```

### 4.2 雾松 Light

```ts
const mistPineLight: ThemeTokens = {
  appBg: '#edf1e8',
  appText: '#253027',
  panelBg: '#f4f7f1',
  panelText: '#344136',
  panelMuted: '#627064',
  contentBg: '#fafcf7',
  contentOverlay: 'rgba(250, 252, 247, 0.92)',
  border: '#d1dacd',
  borderSoft: '#e1e8de',
  buttonBg: '#fafcf7',
  buttonHover: '#e4ede1',
  buttonText: '#253027',
  primary: '#47705a',
  primaryHover: '#395d4a',
  primaryText: '#ffffff',
  selectedBg: '#dce7dc',
  selectedText: '#335c47',
  segmentedBg: '#e5ebe2',
  activeBg: '#fafcf7',
  dirtyBg: '#f3e8c7',
  dirtyText: '#6a520e',
  muted: '#627064',
  dot: '#8d998f',
  editorBg: '#fafcf7',
  editorText: '#253027',
  editorGutterBg: '#edf2ea',
  editorGutterText: '#627064',
  editorCursor: '#47705a',
  editorSelection: '#cddfce',
  editorLine: '#edf3eb',
  editorKeyword: '#3f684f',
  editorHeading: '#386753',
  editorLink: '#416b59',
  editorString: '#6d5b16',
  editorComment: '#627064',
  editorCode: '#7a4a56',
  markdownText: '#253027',
  markdownH1: '#315f49',
  markdownH2: '#3a6750',
  markdownH3: '#416b59',
  markdownH4: '#526546',
  markdownH5: '#6d5b16',
  markdownH6: '#76505b',
  markdownLink: '#416b59',
  markdownQuoteText: '#59665b',
  markdownQuoteBorder: '#47705a',
  markdownCodeBg: '#e6ece2',
  markdownCodeText: '#754653',
  markdownPreBg: '#edf3eb',
  markdownTableHeaderBg: '#e5ece2',
  markdownRule: '#d7ded4',
  dropBg: 'rgba(220, 231, 220, 0.90)'
};
```

### 4.3 藕灰 Light

```ts
const lotusGrayLight: ThemeTokens = {
  appBg: '#f2eceb',
  appText: '#31292b',
  panelBg: '#f8f3f2',
  panelText: '#413638',
  panelMuted: '#756568',
  contentBg: '#fcf9f8',
  contentOverlay: 'rgba(252, 249, 248, 0.92)',
  border: '#ddd2d2',
  borderSoft: '#eae1e0',
  buttonBg: '#fcf9f8',
  buttonHover: '#f0e4e3',
  buttonText: '#31292b',
  primary: '#7d5d62',
  primaryHover: '#674b50',
  primaryText: '#ffffff',
  selectedBg: '#eadcdc',
  selectedText: '#68474d',
  segmentedBg: '#ece3e2',
  activeBg: '#fcf9f8',
  dirtyBg: '#f6e6c7',
  dirtyText: '#6d4f0f',
  muted: '#756568',
  dot: '#9d8e90',
  editorBg: '#fcf9f8',
  editorText: '#31292b',
  editorGutterBg: '#f2ebea',
  editorGutterText: '#756568',
  editorCursor: '#7d5d62',
  editorSelection: '#e2d0d2',
  editorLine: '#f3eaea',
  editorKeyword: '#77545b',
  editorHeading: '#6f5157',
  editorLink: '#6f575d',
  editorString: '#725a1c',
  editorComment: '#756568',
  editorCode: '#8b485e',
  markdownText: '#31292b',
  markdownH1: '#684b51',
  markdownH2: '#74545a',
  markdownH3: '#6e5b65',
  markdownH4: '#5f6252',
  markdownH5: '#745a1e',
  markdownH6: '#7f4d60',
  markdownLink: '#6f575d',
  markdownQuoteText: '#6f6063',
  markdownQuoteBorder: '#7d5d62',
  markdownCodeBg: '#ece3e2',
  markdownCodeText: '#84465a',
  markdownPreBg: '#f4edec',
  markdownTableHeaderBg: '#eee4e3',
  markdownRule: '#ded4d4',
  dropBg: 'rgba(234, 220, 220, 0.90)'
};
```

## 5. 对比度基线

| 检查项 | 稻纸 | 雾松 | 藕灰 | 目标 |
| --- | ---: | ---: | ---: | ---: |
| 正文 / 内容背景 | 13.65:1 | 13.28:1 | 13.52:1 | ≥ 4.5:1 |
| 面板次级文字 / 面板背景 | 4.91:1 | 4.83:1 | 5.00:1 | ≥ 4.5:1 |
| 主按钮文字 / 主色 | 5.10:1 | 5.63:1 | 5.81:1 | ≥ 4.5:1 |
| 编辑器行号 / 行号背景 | 4.62:1 | 4.60:1 | 4.67:1 | ≥ 4.5:1 |
| Markdown 链接 / 内容背景 | 5.64:1 | 5.86:1 | 6.27:1 | ≥ 4.5:1 |
| 选中文字 / 选中背景 | 6.05:1 | 5.98:1 | 6.07:1 | ≥ 4.5:1 |

标题、引用、代码、编辑器语法色的设计值均不低于 `4.5:1`。边框属于层级提示，不承担唯一的交互状态表达；键盘焦点仍由高对比度 `primary` 轮廓负责。

## 6. 产品行为

- 三套主题都是内置浅色主题，`mode` 固定为 `light`。
- 主题选择后继续写入现有 `md-view-theme-id`，不增加新的存储键。
- 重新加载应用时恢复新主题；旧的 `paper-light`、其他现有 ID 和无效 ID 的回退行为保持不变。
- 导出 HTML 时沿用当前逻辑，将所选主题 token 写入导出文件。
- 带背景图时使用更高不透明度的 `contentOverlay`，但不承诺任意极端背景图都能保持同等阅读效果。
- 主题选择器暂不增加分类字段或新的弹窗结构，避免扩大菜单改造范围。

## 7. 非目标

- 不替换现有 `暖纸 Light`。
- 不增加自动跟随日出日落、环境光或系统色温的能力。
- 不增加“护眼模式”开关或健康效果承诺。
- 不调整阅读字号、行高、字体或背景图功能。
- 不改变 `ThemeTokens` 类型结构。

## 8. 验收标准

1. 三个新 ID 可在桌面 Plus、Lite 和 Web Plus 的现有主题入口中选择。
2. 阅读、源码、所见即所得、分栏视图均完整应用主题。
3. CodeMirror 行号、选区、当前行和语法色无低对比度回退。
4. Markdown 标题、链接、引用、行内代码、代码块、表格和分隔线层次清晰。
5. 切换、刷新、HTML 导出和已有主题兼容行为正常。
6. 桌面与窄屏下菜单文字不截断，不产生新的横向滚动。
