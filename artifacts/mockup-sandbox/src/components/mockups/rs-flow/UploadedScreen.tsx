const screens: Record<string, string> = {
  splash: "rs-screen-01-splash.png",
  profile: "rs-screen-05-profile.png",
  connect: "rs-screen-06-connect.png",
  permissions: "rs-screen-07-permissions.png",
  validation: "rs-screen-08-validation.png",
  vibe: "rs-screen-09-vibe.png",
  room: "rs-screen-10-active-room.png",
  summary: "rs-screen-11-summary.png",
  grace: "rs-screen-12-grace.png",
  matchmaking: "rs-screen-13-matchmaking.png",
  history: "rs-screen-14-history.png",
  settings: "rs-screen-15-settings.png",
};

export function UploadedScreen() {
  const requested =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("screen")
      : null;
  const image = screens[requested ?? ""] ?? screens.profile;

  return (
    <main className="flex min-h-screen items-start justify-center bg-black">
      <img
        className="block h-auto w-full max-w-[448px]"
        src={`/__mockup/images/${image}`}
        alt="Uploaded RS Chats app screen"
      />
    </main>
  );
}