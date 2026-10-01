"use client";
import Image from "next/image";
import pseLogo from "@/img/iconos/logo-pse.png";
import addiLogo from "@/img/iconos/addi_negro.png";
import { PaymentMethod } from "../types";
import { useEffect, useState } from "react";
import { fetchBanks } from "../utils";

// Lista de bancos disponibles para PSE en Colombia
interface AlternativePaymentMethodsProps {
  readonly selectedMethod: string;
  readonly onMethodChange: (method: PaymentMethod) => void;
  readonly selectedBank?: string;
  readonly onBankChange?: (bankCode: string, bankName?: string) => void;
}

export default function AlternativePaymentMethods({
  selectedMethod,
  onMethodChange,
  selectedBank,
  onBankChange,
}: AlternativePaymentMethodsProps) {
  const [banks, setBanks] = useState<{ bankCode: string; bankName: string }[]>(
    []
  );
  useEffect(() => {
    fetchBanks().then((res) => {
      setBanks(res);
    });
  }, []);
  return (
    <div
      className="px-6 pb-2 flex flex-col gap-2"
      style={{ background: "#fff" }}
    >
      {/* PSE Option */}
      <label className="flex items-center gap-2 justify-between mt-4">
        <span className="flex items-center gap-2">
          <input
            type="radio"
            name="payment"
            checked={selectedMethod === "pse"}
            onChange={() => onMethodChange("pse")}
            className="accent-blue-600 w-5 h-5"
          />
          <span className="font-medium text-black">PSE - Débito bancario</span>
        </span>
        <div className="flex items-center justify-center">
          <Image
            src={pseLogo}
            alt="PSE"
            width={35}
            height={35}
            className="object-contain"
          />
        </div>
      </label>

      {/* Bank selector for PSE */}
      {selectedMethod === "pse" && (
        <div className="ml-7 mt-2 mb-4">
          <label
            htmlFor="bank-select"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Selecciona tu banco
          </label>
          <select
            id="bank-select"
            value={selectedBank || ""}
            onChange={(e) => {
              const code = e.target.value;
              const bank = banks.find((b) => String(b.bankCode) === code);
              onBankChange?.(code, bank?.bankName);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            required={selectedMethod === "pse"}
          >
            <option value="">Elige tu banco...</option>
            {banks.map((bank) => (
              <option key={bank.bankCode} value={bank.bankCode}>
                {bank.bankName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Addi Option */}
      <label className="flex items-center gap-2 justify-between">
        <span className="flex items-center gap-2">
          <input
            type="radio"
            name="payment"
            checked={selectedMethod === "addi"}
            onChange={() => onMethodChange("addi")}
            className="accent-blue-600 w-5 h-5"
          />
          <span className="font-medium text-black">Addi - Paga después</span>
        </span>
        <div className="flex items-center justify-center">
          <Image
            src={addiLogo}
            alt="Addi"
            width={89}
            height={35}
            className="object-contain"
          />
        </div>
      </label>
    </div>
  );
}
