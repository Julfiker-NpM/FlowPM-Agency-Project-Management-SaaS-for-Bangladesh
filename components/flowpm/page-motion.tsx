"use client";

import { motion } from "framer-motion";

export function PageMotion({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="block w-full min-w-0"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
