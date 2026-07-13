"use client";

import { useEffect } from "react";
import clarity from "@microsoft/clarity";

export default function ClarityTracker() {
  useEffect(() => {
    // Initialize Clarity with your specific Project ID
    clarity.init("xloovmala4");
  }, []);

  // This component doesn't render any UI
  return null; 
}