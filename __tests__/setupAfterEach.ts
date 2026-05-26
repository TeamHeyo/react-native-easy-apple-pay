// Silence the library's own "[react-native-easy-apple-pay] X is only available on iOS"
// warnings so the test output stays readable.

const realConsoleWarn = console.warn;
beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (msg.includes("[react-native-easy-apple-pay]")) return;
    realConsoleWarn(...(args as Parameters<typeof realConsoleWarn>));
  });
});

afterEach(() => {
  jest.clearAllMocks();
});
