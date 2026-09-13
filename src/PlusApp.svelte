<script lang="ts">
  import PlusSettingsPanel from './components/PlusSettingsPanel.svelte';
  import AppShell from './AppShell.svelte';
  import { editionDisplayName, plusMarkdownStatus } from './edition';
  import { exportHtml } from './api';
  import {
    defaultPlusPreferences,
    loadPlusPreferences,
    plusReaderStyle,
    savePlusPreferences
  } from './plusPreferences';
</script>

<AppShell
  {editionDisplayName}
  defaultPreviewPreferences={defaultPlusPreferences}
  loadPreviewPreferences={loadPlusPreferences}
  savePreviewPreferences={savePlusPreferences}
  previewReaderStyle={plusReaderStyle}
  markdownStatus={plusMarkdownStatus}
  settingsPanelComponent={PlusSettingsPanel}
  enableHeadingSearch={true}
  exportHtmlFile={exportHtml}
/>
