"use client";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";

function getExtensions(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["mjs", "cjs", "js", "ts"].includes(ext)) {
    return [javascript({ typescript: ext === "ts" })];
  }
  if (ext === "py") {
    return [python()];
  }
  if (ext === "sh" || ext === "bash") {
    return [StreamLanguage.define(shell)];
  }
  return [];
}

interface ScriptEditorProps {
  filename: string;
  value: string;
  onChange: (value: string) => void;
}

export function ScriptEditor({ filename, value, onChange }: ScriptEditorProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={getExtensions(filename)}
      theme={isDark ? githubDark : githubLight}
      minHeight="400px"
      style={{ fontSize: "12px" }}
    />
  );
}
