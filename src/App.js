import React, { useState, useEffect } from "react";
import JSZip from "jszip";
import * as cheerio from "cheerio";

function App() {
  const [previewHtml, setPreviewHtml] = useState(null);
  const [fileName, setFileName] = useState("");
  const [orientation, setOrientation] = useState("portrait");
  const [editableTextItems, setEditableTextItems] = useState([]);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const devices = {
    "iPhone SE (1st gen)": { width: 320, height: 568 },
    "iPhone SE (2nd/3rd), 6/7/8": { width: 375, height: 667 },
    "iPhone 6+/7+/8+": { width: 414, height: 736 },
    "iPhone X / XS / 11 Pro / 13 Mini": { width: 375, height: 812 },
    "iPhone XR / 11 / XS Max / 11 Pro Max": { width: 414, height: 896 },
    "iPhone 12 / 13 / 14 / 14 Pro": { width: 390, height: 844 },
    "iPhone 12 Mini": { width: 360, height: 780 },
    "iPhone 12 Pro Max / 13 Pro Max / 14 Plus": { width: 428, height: 926 },
    "iPhone 14 Pro Max / 15 Pro Max": { width: 430, height: 932 },
  };

  const [selectedDevice, setSelectedDevice] = useState("iPhone 12 / 13 / 14 / 14 Pro");

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const ext = file.name.split(".").pop().toLowerCase();

    const processHtml = (html) => {
      const updatedHtml = injectTouchEmulation(html);
      const { html: finalHtml, items } = extractEditableText(updatedHtml);
      setEditableTextItems(items);
      setPreviewHtml(finalHtml);
    };

    if (ext === "zip") {
      const zip = await JSZip.loadAsync(file);
      const indexFile = zip.file(/index\\.html$/i)[0];
      if (indexFile) processHtml(await indexFile.async("string"));
      else alert("index.html не знайдено в ZIP-файлі");
    } else if (ext === "html") {
      const reader = new FileReader();
      reader.onload = (e) => processHtml(e.target.result);
      reader.readAsText(file);
    } else alert("Підтримуються тільки .zip або .html файли");
  };

  const injectTouchEmulation = (html) => html.replace("</body>", `
    <script>(function () {
      function triggerTouch(type, mouseEvent) {
        const touchObj = new Touch({
          identifier: Date.now(), target: mouseEvent.target,
          clientX: mouseEvent.clientX, clientY: mouseEvent.clientY,
          screenX: mouseEvent.screenX, screenY: mouseEvent.screenY,
          pageX: mouseEvent.pageX, pageY: mouseEvent.pageY,
          radiusX: 2.5, radiusY: 2.5, rotationAngle: 10, force: 0.5 });
        const touchEvent = new TouchEvent(type, {
          cancelable: true, bubbles: true,
          touches: [touchObj], targetTouches: [], changedTouches: [touchObj], shiftKey: true });
        mouseEvent.target.dispatchEvent(touchEvent);
      }
      document.addEventListener('mousedown', (e) => triggerTouch('touchstart', e));
      document.addEventListener('mousemove', (e) => triggerTouch('touchmove', e));
      document.addEventListener('mouseup', (e) => triggerTouch('touchend', e));
    })();</script></body>`);

  const extractEditableText = (html) => {
    const $ = cheerio.load(html, { decodeEntities: false });
    const textElements = [];
    let uidCounter = 0;

    $('body *').each((_, el) => {
      const $el = $(el);
      const tagName = el.tagName.toLowerCase();
      if (["script", "style", "noscript"].includes(tagName)) return;

      $el.contents().each((_, node) => {
        if (node.type === 'text' && node.data.trim().length > 0) {
          const uid = `text-${uidCounter++}`;
          const $span = $('<span>')
            .attr('data-uid', uid)
            .text(node.data);
          $(node).replaceWith($span);
          textElements.push({ selector: `span[data-uid="${uid}"]`, tag: 'span', text: node.data.trim(), index: uidCounter });
        }
      });
    });

    return { html: $.html(), items: textElements };
  };

  const handleTextChange = (index, newText) => {
    setEditableTextItems((prev) => {
      const updated = [...prev];
      updated[index].text = newText;
      return updated;
    });
  };

  const applyTextChanges = () => {
    const $ = cheerio.load(previewHtml, { decodeEntities: false });
    editableTextItems.forEach((item) => {
      const $el = $(item.selector);
      if ($el.length > 0) {
        const formattedText = item.text.replace(/(?:\r?\n){2,}/g, "<br><br>").replace(/\r?\n/g, " ");
        $el.html(formattedText);
      }
    });
    setPreviewHtml($.html());
  };

  const downloadHtml = () => {
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `updated-${fileName || "index.html"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentDevice = devices[selectedDevice];
  const width = orientation === "portrait" ? currentDevice.width : currentDevice.height;
  const height = orientation === "portrait" ? currentDevice.height : currentDevice.width;
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const availableWidth = window.innerWidth * 0.4 - 18;
      const availableHeight = window.innerHeight - 60;
      setScale(Math.min(availableWidth / width, availableHeight / height, 1));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [width, height]);

  return (
    <div className={darkMode ? "dark" : ""}>
      <button onClick={() => setDarkMode(!darkMode)} className="fixed top-4 right-4 z-50 px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 text-black dark:text-white shadow">
        {darkMode ? "🌙 Темна тема" : "☀️ Світла тема"}
      </button>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex text-black dark:text-white">
        <div className="w-[60%] p-4 overflow-y-auto h-screen">
          <h1 className="text-2xl font-bold mb-4">🎮 Playable Ad Variator</h1>
          <input type="file" accept=".zip,.html" onChange={handleFileUpload} className="mb-4" />

          <div className="mb-4">
            <label className="mr-2 font-medium">Орієнтація:</label>
            <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="border px-2 py-1 rounded text-black bg-white">
              <option value="portrait">Портрет</option>
              <option value="landscape">Ландшафт</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="mr-2 font-medium">Пристрій:</label>
            <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="border px-2 py-1 rounded text-black bg-white">
              {Object.keys(devices).map((device) => (
                <option key={device} value={device}>{device}</option>
              ))}
            </select>
          </div>

          {editableTextItems.length > 0 && (
            <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded shadow">
              <h3 className="text-lg font-semibold mb-2">Редагування текстів</h3>
              {editableTextItems.map((item, idx) => (
                <div key={item.selector} className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {item.tag} #{item.index}
                  </label>
                  <textarea
                    value={item.text}
                    onChange={(e) => handleTextChange(idx, e.target.value)}
                    className="w-full border px-2 py-1 rounded resize-y dark:bg-gray-900 dark:text-white"
                    rows={Math.max(2, item.text.split("\n").length)}
                  />
                </div>
              ))}
              <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded" onClick={applyTextChanges}>Застосувати зміни</button>
              <button className="mt-2 bg-green-600 text-white px-4 py-2 rounded ml-2" onClick={downloadHtml}>Завантажити HTML</button>
            </div>
          )}
        </div>

        {previewHtml && (
          <div className="w-[40%] h-screen fixed right-0 top-0 border-l shadow-lg bg-white dark:bg-gray-950 p-4 overflow-hidden">
            <h2 className="text-lg font-semibold mb-2">Перегляд: {fileName}</h2>
            <div className="flex justify-center items-start h-full overflow-hidden">
              <div style={{ width: `${width}px`, height: `${height}px`, transform: `scale(${scale})`, transformOrigin: "top center" }} className="transition-transform duration-300">
                <iframe
                  key={previewHtml} // 🔁 Оновлення iframe при зміні HTML
                  srcDoc={previewHtml}
                  title="Playable Preview"
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
