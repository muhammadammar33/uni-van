import { Send } from "lucide-react";

/** Opens WhatsApp with a ready message (the person picks the group). */
export function WhatsAppShareButton({ text, label = "Share", className = "" }: { text: string; label?: string; className?: string }) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noreferrer"
      className={`btn flex-1 bg-[#25D366] !py-2 text-white shadow-sm shadow-[#25D366]/30 hover:bg-[#1ebe5b] ${className}`}
    >
      <Send className="size-4" /> {label}
    </a>
  );
}
