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

add all env value in src/config/config.ts
import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;


- lock records (ASM) (3 days)
- final result (ASM, CHT) and lock record
- ASM check (3 days), notify LARK, notify in UI
- select all (ticked box)
- modify history 

bugs:

- update/create for lower prive
- refresh UI when login to webpage 


# colors
#272725
#191919
#1c1c1c

border: #757473 #373736
