export function applicationEnvironment(source) {
  return {
    ...Object.fromEntries(Object.entries(source).filter(([name]) =>
      !/^(?:TEST_USER_|E2E_|FORCE_COLOR$)|(?:SECRET|PASSWORD|PASSCODE|SERVICE_ROLE|ACCESS_TOKEN|DB_URL)/i.test(name),
    )),
    NODE_ENV: 'development',
    NEXT_TELEMETRY_DISABLED: '1',
  };
}
