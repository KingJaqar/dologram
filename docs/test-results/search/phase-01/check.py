import concurrent.futures, importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('checks', pathlib.Path(__file__).with_name('run-baselines.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.OUT = pathlib.Path(__file__).resolve().parent / sys.argv[1]
module.OUT.mkdir(parents=True, exist_ok=False)
checks = {}
for arg in sys.argv[2:]:
 if arg in module.CHECKS:
  checks[arg] = module.CHECKS[arg]
 elif arg == 'foundation':
  tests = ['src/search/__tests__/query.test.ts', 'src/search/__tests__/matching.test.ts',
   'src/search/__tests__/people.test.ts', 'src/search/__tests__/useMessageSearch.test.tsx',
   'src/search/__tests__/SearchResultRow.test.tsx', 'src/components/__tests__/SearchField.test.tsx']
  checks[arg] = (['npm.cmd','--workspace','@dologram/mobile','run','test','--','--runInBand','--watch=false',
   '--cacheDirectory',str(module.ROOT / '.tmp/search-phase01-jest'),'--runTestsByPath',*tests],120)
 elif arg == 'accessibility':
  checks[arg] = (['npm.cmd','--workspace','@dologram/mobile','run','test','--','--runInBand','--watch=false',
   '--cacheDirectory',str(module.ROOT / '.tmp/search-phase01-jest'),'--runTestsByPath',
   'src/__tests__/a11yPressableSource.test.ts','src/components/__tests__/a11yLabels.test.tsx'],120)
 elif arg == 'chat-list':
  checks[arg] = (['npm.cmd','--workspace','@dologram/mobile','run','test','--','--runInBand','--watch=false',
   '--cacheDirectory',str(module.ROOT / '.tmp/search-phase01-jest'),'--runTestsByPath',
   'src/chatList/__tests__/useChatList.test.tsx','src/chatList/__tests__/preferences.test.ts'],120)
 else: raise ValueError(arg)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 list(pool.map(module.run, checks.items()))
