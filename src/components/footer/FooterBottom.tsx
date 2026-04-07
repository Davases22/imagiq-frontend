/**
 * FooterBottom Component
 * Sección inferior del footer con copyright, enlaces legales y logo de superintendencia
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { posthogUtils } from "@/lib/posthogClient";
import { companyInfo, legalLinks } from "./footer-config";
import { SocialLinks } from "./SocialLinks";

interface FooterBottomProps {
  readonly isVisible: boolean;
}

export function FooterBottom({ isVisible }: FooterBottomProps) {
  const handleLegalClick = (linkName: string, href: string) => {
    posthogUtils.capture("footer_legal_click", {
      link: linkName,
      href,
    });
  };

  return (
    <div
      className={`mt-12 pt-8 border-t border-gray-200 transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: "300ms" }}
    >
      {/* Información de la compañía y Logo superintendencia */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-6">
        <div className="space-y-1" data-nosnippet>
          <p className="text-xs text-gray-500 font-bold">{companyInfo.copyright}</p>
          <p className="text-xs text-gray-500 font-bold">{companyInfo.address}</p>
          <p className="text-xs text-gray-500 font-bold">{companyInfo.contact}</p>
        </div>

        {/* Logo superintendencia */}
        {companyInfo.superintendencia && (
          <div className="flex items-start">
            <Image
              src="https://res.cloudinary.com/dzi2p0pqa/image/upload/v1762481799/zkdq2trxrgmxrygzftdh.png"
              alt="Industria y Comercio Superintendencia"
              width={180}
              height={40}
              className="h-10 w-auto"
            />
          </div>
        )}
      </div>

      {/* Enlaces legales y redes sociales (debajo del borde) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-6 border-t border-gray-100">
        {/* Enlaces legales */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="text-gray-600 font-semibold">{companyInfo.country}</span>
          {legalLinks.map((link, index) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-gray-600 hover:text-blue-600 hover:underline transition-colors"
              onClick={() => handleLegalClick(link.name, link.href)}
              style={{ transitionDelay: `${400 + index * 50}ms` }}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Redes sociales */}
        <SocialLinks isVisible={isVisible} />
      </div>
    </div>
  );
}
