// src/components/world/Station.jsx
// Drop <Station name="services" /> into a page to send the shared 3D world
// there. Optional overrides, e.g. <Station name="service" tint="#3FB8FF" />.
"use client";

import { useEffect } from "react";
import { setStation } from "@/components/world/worldStore";

export default function Station({ name, ...overrides }) {
    const key = JSON.stringify(overrides);
    useEffect(() => {
        setStation(name, JSON.parse(key));
    }, [name, key]);
    return null;
}
