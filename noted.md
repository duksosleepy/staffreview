rowToItemId1 -> key/value (need to enhance)
vueuse -> signal for refresh sheet 1
  ┌──────────────────────┬─────────────────────────┬────────────────────────────────┐
  │        Issue         │         Current         │            Improved            │
  ├──────────────────────┼─────────────────────────┼────────────────────────────────┤
  │ Clear cells          │ 2000 setValue('') calls │ 1 clearContent() call          │
  ├──────────────────────┼─────────────────────────┼────────────────────────────────┤
  │ Set data             │ N × M setValue() calls  │ 1 setValues(matrix) call       │
  ├──────────────────────┼─────────────────────────┼────────────────────────────────┤
  │ Date change handling │ Immediate, no debounce  │ 300ms debounce                 │
  ├──────────────────────┼─────────────────────────┼────────────────────────────────┤
  │ Concurrent requests  │ Race condition possible │ AbortController + loading lock │
  └──────────────────────┴─────────────────────────┴────────────────────────────────┘
