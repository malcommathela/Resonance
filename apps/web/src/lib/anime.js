import anime from 'animejs'

export const animations = {
  // Page entrance animations
  fadeInUp: (targets, delay = 0) => {
    anime({
      targets,
      opacity: [0, 1],
      translateY: [30, 0],
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      duration: 800,
      delay,
    })
  },

  fadeIn: (targets, delay = 0) => {
    anime({
      targets,
      opacity: [0, 1],
      easing: 'easeOutQuad',
      duration: 600,
      delay,
    })
  },

  scaleIn: (targets, delay = 0) => {
    anime({
      targets,
      opacity: [0, 1],
      scale: [0.9, 1],
      easing: 'cubicBezier(0.34, 1.56, 0.64, 1)',
      duration: 600,
      delay,
    })
  },

  slideInLeft: (targets, delay = 0) => {
    anime({
      targets,
      opacity: [0, 1],
      translateX: [-50, 0],
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      duration: 700,
      delay,
    })
  },

  slideInRight: (targets, delay = 0) => {
    anime({
      targets,
      opacity: [0, 1],
      translateX: [50, 0],
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      duration: 700,
      delay,
    })
  },

  // Stagger animations
  staggerFadeIn: (targets, staggerDelay = 100) => {
    anime({
      targets,
      opacity: [0, 1],
      translateY: [20, 0],
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      duration: 600,
      delay: anime.stagger(staggerDelay),
    })
  },

  // Interactive animations
  pulse: (targets) => {
    anime({
      targets,
      scale: [1, 1.05, 1],
      easing: 'easeInOutQuad',
      duration: 400,
    })
  },

  shake: (targets) => {
    anime({
      targets,
      translateX: [0, -10, 10, -10, 10, 0],
      easing: 'easeInOutQuad',
      duration: 500,
    })
  },

  glow: (targets) => {
    anime({
      targets,
      boxShadow: [
        '0 0 0px rgba(139, 92, 246, 0)',
        '0 0 20px rgba(139, 92, 246, 0.5)',
        '0 0 0px rgba(139, 92, 246, 0)',
      ],
      easing: 'easeInOutQuad',
      duration: 1500,
      loop: true,
    })
  },

  // Number counting animation
  countUp: (targets, from = 0, to = 100, duration = 1000) => {
    const obj = { value: from }
    anime({
      targets: obj,
      value: to,
      round: 1,
      easing: 'easeOutExpo',
      duration,
      update: () => {
        if (targets) targets.textContent = obj.value
      },
    })
  },

  // Canvas block entrance
  blockEnter: (targets) => {
    anime({
      targets,
      opacity: [0, 1],
      scale: [0.5, 1],
      translateY: [20, 0],
      easing: 'cubicBezier(0.34, 1.56, 0.64, 1)',
      duration: 500,
    })
  },

  // Connection draw animation
  drawLine: (targets) => {
    anime({
      targets,
      strokeDashoffset: [anime.setDashoffset, 0],
      easing: 'easeInOutSine',
      duration: 800,
    })
  },

  // Simulation pulse on blocks
  simPulse: (targets) => {
    anime({
      targets,
      scale: [1, 1.08, 1],
      boxShadow: [
        '0 0 0px rgba(139, 92, 246, 0)',
        '0 0 30px rgba(139, 92, 246, 0.6)',
        '0 0 0px rgba(139, 92, 246, 0)',
      ],
      easing: 'easeInOutQuad',
      duration: 1000,
      loop: true,
    })
  },

  // Floating animation for decorative elements
  float: (targets) => {
    anime({
      targets,
      translateY: [-10, 10],
      rotate: [-2, 2],
      easing: 'easeInOutSine',
      duration: 3000,
      loop: true,
      direction: 'alternate',
    })
  },

  // Background gradient animation
  gradientShift: (targets) => {
    anime({
      targets,
      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      easing: 'linear',
      duration: 15000,
      loop: true,
    })
  },

  // Modal entrance
  modalEnter: (targets) => {
    anime({
      targets,
      opacity: [0, 1],
      scale: [0.95, 1],
      translateY: [20, 0],
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      duration: 400,
    })
  },

  // Modal backdrop
  backdropFade: (targets) => {
    anime({
      targets,
      opacity: [0, 1],
      easing: 'easeOutQuad',
      duration: 300,
    })
  },
}

export default animations
