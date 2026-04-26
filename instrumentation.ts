export async function register() {
  // Guard build phase (§0.9.20)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { startSession, getSessionStatus } = await import("./src/lib/waha");
  try {
    const status = await getSessionStatus();
    if (status !== "WORKING") {
      await startSession();
      console.log(JSON.stringify({ event: "waha.session_started" }));
    } else {
      console.log(JSON.stringify({ event: "waha.session_already_working" }));
    }
  } catch (err) {
    console.error(JSON.stringify({ event: "waha.session_init_failed", err: String(err) }));
  }
}
