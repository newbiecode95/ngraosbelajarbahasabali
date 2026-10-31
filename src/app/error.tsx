"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <span className="brand">
        ngraos<span>!</span>
      </span>
      <h1>Ada yang tersendat.</h1>
      <p>Progres yang sudah tersimpan tetap aman. Mari coba lagi.</p>
      <button className="btn primary" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}
