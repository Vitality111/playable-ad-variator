"use client";
import dynamic from "next/dynamic";

// Вимикаємо SSR для редактора, щоби не було hydration error
const Editor = dynamic(() => import("./Editor"), { ssr: false });

export default function Page() {
  return <Editor />;
}
