"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function useToastFeedback(error?: string, feedback?: string) {
  const lastErrorRef = useRef("");
  const lastFeedbackRef = useRef("");

  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      toast.error(error);
      lastErrorRef.current = error;
    }

    if (!error) {
      lastErrorRef.current = "";
    }
  }, [error]);

  useEffect(() => {
    if (feedback && feedback !== lastFeedbackRef.current) {
      toast.success(feedback);
      lastFeedbackRef.current = feedback;
    }

    if (!feedback) {
      lastFeedbackRef.current = "";
    }
  }, [feedback]);
}
