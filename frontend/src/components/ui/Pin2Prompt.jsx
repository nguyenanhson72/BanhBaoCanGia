import React, { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input, Label } from "./Input";
import { ShieldCheck } from "lucide-react";
import api, { setPin2 } from "../../lib/api";
import { toast } from "./Toast";

/**
 * Reusable PIN2 prompt. Use:
 *   const [ask, setAsk] = useState(false);
 *   ...
 *   <Pin2Prompt open={ask} onClose={() => setAsk(false)} onVerified={() => { setAsk(false); doAction(); }} />
 */
export default function Pin2Prompt({ open, onClose, onVerified, action = "thực hiện thao tác này" }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!pin) return;
    setBusy(true);
    try {
      await api.post("/security/verify-pin2", { pin });
      setPin2(pin);
      setPin("");
      onVerified?.();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || "PIN2 không đúng", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nhập mật khẩu cấp 2" size="sm" testId="pin2-modal">
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2.5">
          <ShieldCheck size={16} />
          <span>Hệ thống yêu cầu mật khẩu cấp 2 để {action}.</span>
        </div>
        <div>
          <Label>Mật khẩu cấp 2</Label>
          <Input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
            data-testid="pin2-input"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={busy || !pin} data-testid="pin2-submit">
            {busy ? "..." : "Xác nhận"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
