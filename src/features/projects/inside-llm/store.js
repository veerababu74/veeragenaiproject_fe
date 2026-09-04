import { create } from 'zustand'

export const useInsideLLMStore = create((set) => ({
  view: 'walkthrough',
  setView: (view) => set({ view }),

  overview: null,
  components: [],
  models: null,
  positional: null,
  examplesIndex: [],
  setStatic: (payload) => set(payload),

  exampleId: 'repetition',
  setExampleId: (exampleId) => set({ exampleId }),

  example: null,
  setExample: (example) => set({ example }),

  loading: true,
  setLoading: (loading) => set({ loading }),

  error: '',
  setError: (error) => set({ error }),

  // Which of the 144 heads the attention explorer is showing.
  head: { layer: 4, head: 11 },
  setHead: (head) => set({ head }),
}))
