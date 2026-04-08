import { create } from 'zustand';

interface UiState {
  isApiSettingsOpen: boolean;
  isImportDialogOpen: boolean;
  isExportDialogOpen: boolean;
  isSaveSchemaDialogOpen: boolean;
  isLoadSchemaDialogOpen: boolean;
  isPromptLibraryDialogOpen: boolean;
  isUserSettingsDialogOpen: boolean;
  setApiSettingsOpen: (open: boolean) => void;
  setImportDialogOpen: (open: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;
  setSaveSchemaDialogOpen: (open: boolean) => void;
  setLoadSchemaDialogOpen: (open: boolean) => void;
  setPromptLibraryDialogOpen: (open: boolean) => void;
  setUserSettingsDialogOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isApiSettingsOpen: false,
  isImportDialogOpen: false,
  isExportDialogOpen: false,
  isSaveSchemaDialogOpen: false,
  isLoadSchemaDialogOpen: false,
  isPromptLibraryDialogOpen: false,
  isUserSettingsDialogOpen: false,
  setApiSettingsOpen: (open) => set({ isApiSettingsOpen: open }),
  setImportDialogOpen: (open) => set({ isImportDialogOpen: open }),
  setExportDialogOpen: (open) => set({ isExportDialogOpen: open }),
  setSaveSchemaDialogOpen: (open) => set({ isSaveSchemaDialogOpen: open }),
  setLoadSchemaDialogOpen: (open) => set({ isLoadSchemaDialogOpen: open }),
  setPromptLibraryDialogOpen: (open) => set({ isPromptLibraryDialogOpen: open }),
  setUserSettingsDialogOpen: (open) => set({ isUserSettingsDialogOpen: open })
}));
