// src/scene/SceneText.jsx
import React from "react";
import "./sceneText.css";


export default function SceneText() {
    return (
        <>
            {/* ===== TOP LEFT LOGO ===== */}
            <div style={{
                position: 'fixed',
                top: '25px',
                left: '35px',
                zIndex: 100,
                pointerEvents: 'none'
            }}>
                <img
                    src="/logo.png"
                    alt="Aura Infotech"
                    style={{
                        marginTop: '-25px',
                        height: '90px',
                        width: 'auto',
                        objectFit: 'contain'
                    }}
                />
            </div>

            {/* ===== TOP NAVIGATION ===== */}
            <nav style={{
                position: 'fixed',
                top: '30px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 100,
                display: 'flex',
                gap: '50px',
                pointerEvents: 'auto'
            }}>
                {['Home', 'Projects', 'Company', 'About', 'Contact'].map((item, i) => (
                    <a
                        key={i}
                        href={`#${item.toLowerCase()}`}
                        style={{
                            fontFamily: "'Sora', sans-serif",
                            fontWeight: 200,
                            fontSize: '14px',
                            color: '#ffffff',
                            textDecoration: 'none',
                            letterSpacing: '0.05em',
                            opacity: 0.9,
                            transition: 'opacity 0.3s ease, color 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.opacity = '1';
                            e.target.style.color = '#00AEEF';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.opacity = '0.9';
                            e.target.style.color = '#ffffff';
                        }}
                    >
                        {item}
                    </a>
                ))}
            </nav>

            {/* ===== MAIN HEADLINE (Left Side) ===== */}
            <div style={{
                position: 'fixed',
                top: '50%',
                left: '5%',
                transform: 'translateY(-50%)',
                zIndex: 100,
                pointerEvents: 'none',
                maxWidth: '500px'
            }}>
                <h1 style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)',
                    fontWeight: 300,
                    color: '#ffffff',
                    margin: 0,
                    lineHeight: 1.15,
                    letterSpacing: '0.02em',
                    textTransform: 'none'
                }}>
                    Synthesizing
                </h1>

                <h1 style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)',
                    fontWeight: 300,
                    color: '#ffffff',
                    margin: '0.15em 0',
                    lineHeight: 1.15,
                    letterSpacing: '0.02em',
                    textTransform: 'none'
                }}>
                    Algorithmic{' '}
                    <span style={{ fontWeight: 900 }}>
                        Vitality
                    </span>
                </h1>

                <p style={{
                    fontFamily: "'Raleway', sans-serif",
                    fontSize: '16px',
                    fontWeight: 100,
                    color: 'rgba(255, 255, 255, 0.95)',
                    marginTop: '25px',
                    letterSpacing: '0.04em'
                }}>
                    Where advanced systems meet real-world impact
                </p>
            </div>

            {/* ===== BOTTOM SERVICES BAR ===== */}
            <div style={{
                position: 'fixed',
                bottom: '35px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 100,
                pointerEvents: 'none',
                textAlign: 'center',
                width: '92%',
                maxWidth: '1200px'
            }}>
                <p style={{
                    fontFamily: "'Raleway', sans-serif",
                    fontSize: 'clamp(9px, 1.1vw, 12px)',
                    fontWeight: 200,
                    color: 'rgba(255, 255, 255, 0.85)',
                    letterSpacing: '0.1em',
                    margin: 0,
                    lineHeight: 1.8
                }}>
                    Software Development &nbsp;•&nbsp; Web Development &nbsp;•&nbsp; Digital Marketing &nbsp;•&nbsp; Graphic Designing &nbsp;•&nbsp; UI/UX Designing &nbsp;•&nbsp; SEO &nbsp;•&nbsp; Analytics & Data Analysis
                </p>
            </div>
        </>
    );
}