"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export default function NewMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const input = {
      documentNumber: fd.get("documentNumber") as string,
      documentType: fd.get("documentType") as string,
      firstName: fd.get("firstName") as string,
      lastName: fd.get("lastName") as string,
      email: (fd.get("email") as string) || undefined,
      phone: (fd.get("phone") as string) || undefined,
      rfidTag: (fd.get("rfidTag") as string) || undefined,
    };

    try {
      const { createMember } = await import("@/lib/members/actions");
      await createMember(input as never);
      toast.success("Socio creado correctamente");
      router.push("/dashboard/members");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear socio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <Toaster />
      <h1 className="text-2xl font-bold">Nuevo socio</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del socio</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field name="firstName" label="Nombre" required />
              <Field name="lastName" label="Apellidos" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field name="documentNumber" label="Nº documento" required />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Tipo</label>
                <select name="documentType" className="rounded-lg border px-3 py-2 text-sm">
                  <option value="DNI">DNI</option>
                  <option value="NIE">NIE</option>
                  <option value="PASSPORT">Pasaporte</option>
                </select>
              </div>
            </div>
            <Field name="email" label="Email" type="email" />
            <Field name="phone" label="Teléfono" />
            <Field name="rfidTag" label="Tag RFID" placeholder="Opcional" />

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando…" : "Crear socio"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  name, label, type = "text", required = false, placeholder,
}: {
  name: string; label: string; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}{required && " *"}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
