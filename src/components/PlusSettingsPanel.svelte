<script lang="ts">
  import type { PlusPreferences } from '../plusPreferences';

  export let preferences: PlusPreferences;
  export let open = false;
  export let onChange: (preferences: PlusPreferences) => void = () => {};
  export let onClose: () => void = () => {};
  export let onReset: () => void = () => {};
  export let onExportHtml: () => void = () => {};
  export let onPrint: () => void = () => {};

  function update<K extends keyof PlusPreferences>(key: K, value: PlusPreferences[K]) {
    onChange({ ...preferences, [key]: value });
  }

  function numberValue(event: Event) {
    return Number((event.currentTarget as HTMLInputElement).value);
  }
</script>

{#if open}
  <div class="plus-settings-backdrop" role="presentation" on:click={onClose}></div>
  <aside class="plus-settings-panel" aria-label="Plus reader settings">
    <div class="plus-settings-header">
      <div>
        <h2>Plus 阅读设置</h2>
        <p>本地阅读、导出和高级 Markdown 显示</p>
      </div>
      <button type="button" class="panel-icon-button" title="关闭" aria-label="关闭" on:click={onClose}>×</button>
    </div>

    <div class="plus-settings-body">
      <details class="plus-settings-section" open>
        <summary>阅读排版</summary>
        <div class="plus-settings-section-body">
          <label>
            <span>正文宽度</span>
            <select value={preferences.contentWidth} on:change={(event) => update('contentWidth', event.currentTarget.value as PlusPreferences['contentWidth'])}>
              <option value="narrow">窄</option>
              <option value="medium">中</option>
              <option value="wide">宽</option>
              <option value="full">全宽</option>
            </select>
          </label>

          <label>
            <span>字号 {preferences.fontScale}%</span>
            <input type="range" min="85" max="130" step="5" value={preferences.fontScale} on:input={(event) => update('fontScale', numberValue(event))} />
          </label>

          <label>
            <span>行高 {preferences.lineHeight.toFixed(2)}</span>
            <input type="range" min="1.45" max="2" step="0.05" value={preferences.lineHeight} on:input={(event) => update('lineHeight', numberValue(event))} />
          </label>
        </div>
      </details>

      <details class="plus-settings-section" open>
        <summary>Markdown 渲染</summary>
        <div class="plus-settings-section-body">
          <label>
            <span>软换行</span>
            <select value={preferences.softBreakMode} on:change={(event) => update('softBreakMode', event.currentTarget.value as PlusPreferences['softBreakMode'])}>
              <option value="commonmark">CommonMark</option>
              <option value="breaks">换行即换行</option>
            </select>
          </label>

          <label>
            <span>Frontmatter</span>
            <select value={preferences.frontmatterMode} on:change={(event) => update('frontmatterMode', event.currentTarget.value as PlusPreferences['frontmatterMode'])}>
              <option value="properties">属性面板</option>
              <option value="raw">原文</option>
              <option value="hidden">隐藏</option>
            </select>
          </label>

          <label class="plus-check">
            <input type="checkbox" checked={preferences.tocMode === 'render'} on:change={(event) => update('tocMode', event.currentTarget.checked ? 'render' : 'hidden')} />
            <span>渲染 [toc] 文内目录</span>
          </label>

          <label class="plus-check">
            <input type="checkbox" checked={preferences.mathEnabled} on:change={(event) => update('mathEnabled', event.currentTarget.checked)} />
            <span>数学公式</span>
          </label>

          <label class="plus-check">
            <input type="checkbox" checked={preferences.mermaidEnabled} on:change={(event) => update('mermaidEnabled', event.currentTarget.checked)} />
            <span>Mermaid 图表</span>
          </label>

          <label class="plus-check">
            <input type="checkbox" checked={preferences.mermaidControls} on:change={(event) => update('mermaidControls', event.currentTarget.checked)} />
            <span>Mermaid 控件</span>
          </label>
        </div>
      </details>

      <details class="plus-settings-section">
        <summary>同步与校验</summary>
        <div class="plus-settings-section-body">
          <label class="plus-check">
            <input type="checkbox" checked={preferences.validateLocalLinks} on:change={(event) => update('validateLocalLinks', event.currentTarget.checked)} />
            <span>本地链接校验</span>
          </label>

          <label class="plus-check">
            <input type="checkbox" checked={preferences.syncScroll} on:change={(event) => update('syncScroll', event.currentTarget.checked)} />
            <span>编辑/预览同步</span>
          </label>
        </div>
      </details>

      <details class="plus-settings-section">
        <summary>导出</summary>
        <div class="plus-settings-section-body plus-export-actions">
          <button type="button" on:click={onExportHtml}>导出 HTML</button>
          <button type="button" on:click={onPrint}>打印/PDF</button>
        </div>
      </details>
    </div>

    <div class="plus-settings-actions">
      <button type="button" on:click={onReset}>重置</button>
    </div>
  </aside>
{/if}
