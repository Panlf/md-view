<script lang="ts">
  import PlusSettingsPanel from './components/PlusSettingsPanel.svelte';
  import AppShell from './AppShell.svelte';
  import { editionDisplayName, plusMarkdownStatus } from './edition';
  import { exportHtml, indexWorkspaceHeadings } from './tauri';
  import { defaultPlusPreferences, loadPlusPreferences, plusReaderStyle, savePlusPreferences } from './plusPreferences';
</script>

<AppShell
  {editionDisplayName}
  defaultPreviewPreferences={defaultPlusPreferences}
  loadPreviewPreferences={loadPlusPreferences}
  savePreviewPreferences={savePlusPreferences}
  previewReaderStyle={plusReaderStyle}
  markdownStatus={plusMarkdownStatus}
  settingsButtonLabel="高级设置"
  settingsButtonTitle="高级设置"
  settingsUpdatedStatus="Plus 设置已更新"
  settingsPanelComponent={PlusSettingsPanel}
  refreshWorkspaceHeadings={indexWorkspaceHeadings}
  exportHtmlFile={exportHtml}
/>
