"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#050510] text-white flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-red-400 text-lg mb-4">Something went wrong</h2>
          <button
            onClick={reset}
            className="text-sm text-cyan-400 underline"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
