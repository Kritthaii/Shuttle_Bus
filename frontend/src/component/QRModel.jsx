import React from "react";

export function QRModal({ open, title = "QR Code", dataUrl, qrText, onClose }) {
  React.useEffect(() => {
    console.log("qrText", qrText);
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // ล็อก scroll พอเปิด modal
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* modal card */}
      <div className="relative z-10 w-[90%] max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {dataUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={dataUrl}
              alt="QR Code"
              className="w-64 h-64 border rounded"
            />
            <div className="text-xs text-gray-500">
              แสดง QR นี้ให้เจ้าหน้าที่สแกนเพื่อเช็คอิน
            </div>
            <div>กรอก QR ด้วยตนเอง (กรณีไม่สามารถแสกนได้)</div>
            <div className="text-2xl text-gray-900">{qrText}</div>
          </div>
        ) : (
          <div className="text-center text-gray-600">กำลังโหลด QR ...</div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            ปิด
          </button>
          {dataUrl && (
            <a
              href={dataUrl}
              download="qrcode.png"
              className="px-3 py-2 rounded bg-red-700 text-white hover:bg-red-600"
            >
              ดาวน์โหลด
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
