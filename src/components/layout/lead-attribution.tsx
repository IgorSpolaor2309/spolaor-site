"use client";

import { useEffect } from "react";
import { rememberEntry } from "@/lib/leads/client";

// Registra a página de entrada da visita para atribuir o lead à landing certa.
export function LeadAttribution() {
  useEffect(() => rememberEntry(), []);
  return null;
}
