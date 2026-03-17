'use client';

import React, { useState, useEffect } from 'react';
import { Box, Title, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

const heroImages = [
  {
    src: "https://toronto.citynews.ca/wp-content/blogs.dir/sites/10/2022/11/08/Centennial-Park-in-Etobicoke-1536x712.jpg",
    alt: "Toronto park landscape",
    title: "Amrit Vela - The Ambrosial Hours",
    subtitle: "Rise with the sun and crown yourself in sacred time"
  },
  {
    src: "https://firebasestorage.googleapis.com/v0/b/meetingcardapp.firebasestorage.app/o/admin-uploads%2FjjKnWQw2dJdi0CCA1klGM0xdO6X2%2F1753996032695_Screenshot_2025-07-31_170618.png?alt=media&token=1bf15667-aee3-4eea-95a5-8aa0df97f765",
    alt: "Sacred practice session",
    title: "Sacred Morning Practice",
    subtitle: "Join our community in 2.5 hours of transformation"
  },
  {
    src: "https://youngyogamasters.com/wp-content/uploads/2013/03/Guru-Ram-Das-Ashram-Toronto.jpg",
    alt: "Guru Ram Das Ashram Toronto",
    title: "Toronto Spiritual Community",
    subtitle: "Experience the power of group meditation and kirtan"
  }
];

export function HeroBanner() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-slide functionality
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroImages.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroImages.length) % heroImages.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  return (
    <Box className="hero-banner" style={{ position: 'relative' }}>
      <div className="hero-container">
        {heroImages.map((image, index) => (
          <div
            key={index}
            className={`hero-slide ${index === currentSlide ? 'active' : ''}`}
            style={{ backgroundImage: `url(${image.src})` }}
          >
            <div className="hero-overlay">
              <div className="hero-content">
                <Title
                  order={1}
                  style={{
                    fontSize: 'clamp(2rem, 8vw, 3.5rem)',
                    fontWeight: 700,
                    marginBottom: '1rem',
                    textShadow: '3px 3px 6px rgba(0, 0, 0, 0.7)',
                    letterSpacing: '-1px',
                    fontFamily: "'Cinzel', serif"
                  }}
                >
                  {image.title}
                </Title>
                <Text
                  style={{
                    fontSize: 'clamp(1rem, 4vw, 1.4rem)',
                    fontWeight: 300,
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.7)',
                    fontStyle: 'italic',
                    fontFamily: "'Lora', serif"
                  }}
                >
                  {image.subtitle}
                </Text>
              </div>
            </div>
          </div>
        ))}

        <button className="nav-button prev" onClick={prevSlide}>
          <IconChevronLeft size={24} color="white" />
        </button>
        <button className="nav-button next" onClick={nextSlide}>
          <IconChevronRight size={24} color="white" />
        </button>

        <div className="carousel-controls">
          {heroImages.map((_, index) => (
            <div
              key={index}
              className={`carousel-dot ${index === currentSlide ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      </div>
    </Box>
  );
}
