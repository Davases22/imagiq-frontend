"use client";

/**
 * Datos personales del perfil, como pantalla y no como modal: es una de las
 * secciones del menu lateral, igual que Direcciones o Pedidos.
 *
 * El correo NO se edita aqui. Es la llave de la cuenta (identifica, recibe los
 * codigos de acceso y las facturas), asi que cambiarlo tiene que pasar por una
 * verificacion, no por un campo mas del formulario.
 */

import React, { useEffect, useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { useAuthContext } from "@/features/auth/context";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "../../hooks/useProfile";

interface ProfileDataPageProps {
  onBack: () => void;
}

/** Los mismos que ofrece el registro, para no dar opciones distintas segun la pantalla. */
const PAISES = [
  { codigo: "57", bandera: "🇨🇴" },
  { codigo: "1", bandera: "🇺🇸" },
  { codigo: "34", bandera: "🇪🇸" },
  { codigo: "52", bandera: "🇲🇽" },
  { codigo: "54", bandera: "🇦🇷" },
  { codigo: "56", bandera: "🇨🇱" },
  { codigo: "51", bandera: "🇵🇪" },
  { codigo: "593", bandera: "🇪🇨" },
];

const CLASES_CAMPO =
  "w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none transition-colors";

export default function ProfileDataPage({ onBack }: ProfileDataPageProps) {
  const { state, actions, isLoading } = useProfile();
  const authContext = useAuthContext();
  const usuario = state.user;

  const [datos, setDatos] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    codigo_pais: "57",
    fecha_nacimiento: "",
    tipo_documento: "CC",
    numero_documento: "",
  });
  const [guardando, setGuardando] = useState(false);

  // Cambio de correo en tres pasos: se confirma el correo ACTUAL, se escribe el
  // nuevo, y se confirma tambien el nuevo.
  const [pasoCorreo, setPasoCorreo] = useState<
    "cerrado" | "actual" | "nuevo" | "codigo"
  >("cerrado");
  const [codigoActual, setCodigoActual] = useState("");
  const [correoNuevo, setCorreoNuevo] = useState("");
  const [codigoCorreo, setCodigoCorreo] = useState("");
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);

  const cerrarCambioCorreo = () => {
    setPasoCorreo("cerrado");
    setCodigoActual("");
    setCorreoNuevo("");
    setCodigoCorreo("");
  };

  const empezarCambioCorreo = async () => {
    setEnviandoCorreo(true);
    try {
      await apiPost("/api/auth/email-change/start", { userId: usuario!.id });
      setPasoCorreo("actual");
      toast.success("Te enviamos un código a tu correo actual.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo enviar el código.",
      );
    } finally {
      setEnviandoCorreo(false);
    }
  };

  const pedirCodigo = async () => {
    const correo = correoNuevo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      toast.error("Escribe un correo válido.");
      return;
    }
    setEnviandoCorreo(true);
    try {
      await apiPost("/api/auth/email-change/send", {
        userId: usuario!.id,
        nuevoEmail: correo,
        codigoActual,
      });
      setPasoCorreo("codigo");
      toast.success("Te enviamos un código al correo nuevo.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo enviar el código.",
      );
    } finally {
      setEnviandoCorreo(false);
    }
  };

  const confirmarCorreo = async () => {
    if (codigoCorreo.length !== 6) {
      toast.error("El código tiene 6 dígitos.");
      return;
    }
    setEnviandoCorreo(true);
    try {
      await apiPost("/api/auth/email-change/verify", {
        userId: usuario!.id,
        nuevoEmail: correoNuevo.trim().toLowerCase(),
        codigo: codigoCorreo,
      });
      toast.success("Correo actualizado");
      cerrarCambioCorreo();
      // Recargar el perfil para que el correo nuevo se vea en todas partes.
      await actions.refreshData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido o vencido.");
    } finally {
      setEnviandoCorreo(false);
    }
  };

  // El perfil llega async: sin esto el formulario se quedaba vacio si la
  // pantalla se monta antes de que responda.
  useEffect(() => {
    if (!usuario) return;
    setDatos({
      nombre: usuario.nombre || "",
      apellido: usuario.apellido || "",
      telefono: usuario.telefono || authContext.user?.telefono || "",
      codigo_pais: usuario.codigo_pais || "57",
      // <input type="date"> solo entiende YYYY-MM-DD; del backend puede venir
      // un Date o un ISO completo con hora.
      fecha_nacimiento: usuario.fecha_nacimiento
        ? new Date(usuario.fecha_nacimiento).toISOString().slice(0, 10)
        : "",
      tipo_documento: usuario.tipo_documento || "CC",
      numero_documento: usuario.numero_documento || "",
    });
  }, [usuario, authContext.user]);

  const cambiar = (campo: keyof typeof datos, valor: string) =>
    setDatos((prev) => ({ ...prev, [campo]: valor }));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    const res = await actions.updateProfile({
      nombre: datos.nombre,
      apellido: datos.apellido,
      email: usuario?.email || "",
      telefono: datos.telefono,
      codigo_pais: datos.codigo_pais,
      // Vacia se omite: mandar "" revienta la validacion de fecha del backend.
      ...(datos.fecha_nacimiento
        ? { fecha_nacimiento: datos.fecha_nacimiento }
        : {}),
      tipo_documento: datos.tipo_documento,
      numero_documento: datos.numero_documento,
    });
    setGuardando(false);

    if (res.ok) {
      toast.success("Datos actualizados");
    } else {
      toast.error(
        res.error ||
          "No se pudo guardar. Revisa que el teléfono tenga 10 dígitos y el documento entre 6 y 10.",
      );
    }
  };

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-white">
      <form onSubmit={guardar}>
      <div className="border-b-2 border-gray-100 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-full p-2 transition-colors hover:bg-gray-100 lg:hidden"
              aria-label="Volver"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Perfil</h1>
          </div>
          <button
            type="submit"
            disabled={guardando || isLoading}
            className="rounded-xl bg-black px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="space-y-4 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="perfil-nombre" className="mb-1 block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <input
              id="perfil-nombre"
              type="text"
              value={datos.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
              className={CLASES_CAMPO}
              placeholder="Tu nombre"
              required
            />
          </div>
          <div>
            <label htmlFor="perfil-apellido" className="mb-1 block text-sm font-medium text-gray-700">
              Apellido
            </label>
            <input
              id="perfil-apellido"
              type="text"
              value={datos.apellido}
              onChange={(e) => cambiar("apellido", e.target.value)}
              className={CLASES_CAMPO}
              placeholder="Tu apellido"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="perfil-email" className="mb-1 block text-sm font-medium text-gray-700">
            Correo electrónico
          </label>
          <div className="relative">
            <input
              id="perfil-email"
              type="email"
              value={usuario.email}
              readOnly
              aria-describedby="perfil-email-nota"
              className={`${CLASES_CAMPO} cursor-not-allowed bg-gray-50 pr-11 text-gray-600`}
            />
            <Lock
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
          </div>
          {pasoCorreo === "cerrado" && (
            <div className="mt-1.5 space-y-2">
              <p id="perfil-email-nota" className="text-xs text-gray-500">
                Con este correo entras a tu cuenta y recibes tus pedidos.
              </p>
              <button
                type="button"
                onClick={empezarCambioCorreo}
                disabled={enviandoCorreo}
                className="text-sm font-medium text-gray-700 underline underline-offset-4 hover:text-black disabled:opacity-60"
              >
                {enviandoCorreo ? "Enviando código…" : "Cambiar correo"}
              </button>
            </div>
          )}

          {pasoCorreo === "actual" && (
            <div className="mt-3 space-y-3 rounded-xl border-2 border-gray-200 p-4">
              <label htmlFor="perfil-codigo-actual" className="block text-sm font-medium text-gray-700">
                Código enviado a {usuario.email}
              </label>
              <p className="text-xs text-gray-500">
                Primero confirmamos que esta cuenta es tuya.
              </p>
              <input
                id="perfil-codigo-actual"
                type="text"
                inputMode="numeric"
                value={codigoActual}
                onChange={(e) =>
                  setCodigoActual(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (codigoActual.length === 6) setPasoCorreo("nuevo");
                  }
                }}
                maxLength={6}
                className={`${CLASES_CAMPO} tracking-[0.5em]`}
                placeholder="------"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPasoCorreo("nuevo")}
                  disabled={codigoActual.length !== 6}
                  className="rounded-xl bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  Continuar
                </button>
                <button
                  type="button"
                  onClick={empezarCambioCorreo}
                  disabled={enviandoCorreo}
                  className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Reenviar
                </button>
                <button
                  type="button"
                  onClick={cerrarCambioCorreo}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {pasoCorreo === "nuevo" && (
            <div className="mt-3 space-y-3 rounded-xl border-2 border-gray-200 p-4">
              <label htmlFor="perfil-email-nuevo" className="block text-sm font-medium text-gray-700">
                Correo nuevo
              </label>
              <input
                id="perfil-email-nuevo"
                type="email"
                value={correoNuevo}
                onChange={(e) => setCorreoNuevo(e.target.value)}
                onKeyDown={(e) => {
                  // Enter aqui NO debe enviar el formulario de datos: son dos
                  // acciones distintas y guardaria el perfil sin querer.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    pedirCodigo();
                  }
                }}
                className={CLASES_CAMPO}
                placeholder="nuevo@correo.com"
              />
              <p className="text-xs text-gray-500">
                Te enviaremos un segundo código a esa dirección. Tu correo
                actual no cambia hasta que lo confirmes.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={pedirCodigo}
                  disabled={enviandoCorreo}
                  className="rounded-xl bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {enviandoCorreo ? "Enviando…" : "Enviar código"}
                </button>
                <button
                  type="button"
                  onClick={cerrarCambioCorreo}
                  className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {pasoCorreo === "codigo" && (
            <div className="mt-3 space-y-3 rounded-xl border-2 border-gray-200 p-4">
              <label htmlFor="perfil-email-codigo" className="block text-sm font-medium text-gray-700">
                Código enviado a {correoNuevo}
              </label>
              <input
                id="perfil-email-codigo"
                type="text"
                inputMode="numeric"
                value={codigoCorreo}
                onChange={(e) =>
                  setCodigoCorreo(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmarCorreo();
                  }
                }}
                maxLength={6}
                className={`${CLASES_CAMPO} tracking-[0.5em]`}
                placeholder="------"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmarCorreo}
                  disabled={enviandoCorreo || codigoCorreo.length !== 6}
                  className="rounded-xl bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {enviandoCorreo ? "Verificando…" : "Confirmar correo"}
                </button>
                <button
                  type="button"
                  onClick={pedirCodigo}
                  disabled={enviandoCorreo}
                  className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Reenviar
                </button>
                <button
                  type="button"
                  onClick={cerrarCambioCorreo}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="perfil-telefono" className="mb-1 block text-sm font-medium text-gray-700">
              Celular
            </label>
            <div className="flex gap-2">
              <Select
                value={datos.codigo_pais}
                onValueChange={(v) => cambiar("codigo_pais", v)}
              >
                <SelectTrigger className="!h-12 w-28 shrink-0 rounded-xl border-2 border-gray-200 !text-base data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
                  <SelectValue placeholder="+57" />
                </SelectTrigger>
                <SelectContent
                  sideOffset={0}
                  align="start"
                  className="min-w-0 w-(--radix-select-trigger-width) data-[side=bottom]:translate-y-0 data-[side=top]:translate-y-0 data-[side=bottom]:rounded-t-none data-[side=bottom]:border-t-0 data-[side=top]:rounded-b-none data-[side=top]:border-b-0"
                >
                  {PAISES.map((p) => (
                    <SelectItem key={p.codigo} value={p.codigo}>
                      {p.bandera} +{p.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="perfil-telefono"
                type="tel"
                inputMode="numeric"
                value={datos.telefono}
                onChange={(e) => cambiar("telefono", e.target.value.replace(/\D/g, ""))}
                maxLength={10}
                placeholder="10 números, empieza con 3"
                className="!h-12 min-w-0 rounded-xl border-2 border-gray-200 px-4 !text-base focus-visible:border-black"
              />
            </div>
          </div>

          <div className="min-w-0">
            <label htmlFor="perfil-nacimiento" className="mb-1 block text-sm font-medium text-gray-700">
              Fecha de nacimiento
            </label>
            <input
              id="perfil-nacimiento"
              type="date"
              value={datos.fecha_nacimiento}
              onChange={(e) => cambiar("fecha_nacimiento", e.target.value)}
              /* Nadie nace mañana; y 1900 corta fechas absurdas por error. */
              max={new Date().toISOString().slice(0, 10)}
              min="1900-01-01"
              className={`${CLASES_CAMPO} block h-12 w-full`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
          <div>
            <label htmlFor="perfil-tipo-doc" className="mb-1 block text-sm font-medium text-gray-700">
              Tipo
            </label>
            <select
              id="perfil-tipo-doc"
              value={datos.tipo_documento}
              onChange={(e) => cambiar("tipo_documento", e.target.value)}
              className={CLASES_CAMPO}
            >
              {/* Los mismos cuatro que acepta el backend. */}
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="PP">Pasaporte</option>
              <option value="NIT">NIT</option>
            </select>
          </div>
          <div>
            <label htmlFor="perfil-documento" className="mb-1 block text-sm font-medium text-gray-700">
              Número de documento
            </label>
            <input
              id="perfil-documento"
              type="text"
              inputMode="numeric"
              value={datos.numero_documento}
              onChange={(e) =>
                cambiar("numero_documento", e.target.value.replace(/\D/g, ""))
              }
              maxLength={10}
              className={CLASES_CAMPO}
              placeholder="6 a 10 números"
            />
          </div>
        </div>

      </div>
      </form>
    </div>
  );
}
