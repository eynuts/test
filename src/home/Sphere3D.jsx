import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import hiAudio from '../assets/hi.mp3'

export default function Sphere3D({ isSpeaking = false }) {
  const containerRef = useRef(null)
  const sphereRef = useRef(null)
  const mouthRef = useRef(null)
  const ringsRef = useRef(null)
  const particlesRef = useRef(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const analyserRef = useRef(null)
  const soundRef = useRef(null)
  const audioInitializedRef = useRef(false)
  const smoothFrequencyRef = useRef(0)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    if (!sceneRef.current) {
      sceneRef.current = new THREE.Scene()
    }
    const scene = sceneRef.current

    // Mouse tracking
    const handleMouseMove = (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = -(event.clientY / window.innerHeight) * 2 + 1
      mouseRef.current = { x, y }
    }
    window.addEventListener('mousemove', handleMouseMove)

    // Camera setup
    if (!cameraRef.current) {
      cameraRef.current = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      )
      cameraRef.current.position.z = 2.5
    }
    const camera = cameraRef.current

    // Renderer setup
    if (!rendererRef.current) {
      rendererRef.current = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance"
      })
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }
    const renderer = rendererRef.current
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)

    // Audio setup
    const initAudio = () => {
      if (audioInitializedRef.current) return
      
      const listener = new THREE.AudioListener()
      camera.add(listener)

      const sound = new THREE.Audio(listener)
      const audioLoader = new THREE.AudioLoader()
      
      audioLoader.load(hiAudio, (buffer) => {
        sound.setBuffer(buffer)
        sound.setLoop(false)
        sound.setVolume(0.5)
        sound.play()
        soundRef.current = sound
        analyserRef.current = new THREE.AudioAnalyser(sound, 32)
        audioInitializedRef.current = true
      })
    }

    const handleInteraction = () => {
      initAudio()
      if (soundRef.current && !soundRef.current.isPlaying) {
        soundRef.current.play()
      }
    }

    containerRef.current.addEventListener('click', handleInteraction)
    
    // Ensure only one canvas is present
    if (containerRef.current.children.length === 0) {
      containerRef.current.appendChild(renderer.domElement)
    }

    // Initialize objects only once
    if (scene.children.length === 0) {
      // Helper to create a radial gradient texture for the aura
      const createGlowTexture = (color1, color2, color3) => {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const context = canvas.getContext('2d')
        const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128)
        gradient.addColorStop(0, color1)
        gradient.addColorStop(0.3, color2)
        gradient.addColorStop(0.6, color3)
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
        context.fillStyle = gradient
        context.fillRect(0, 0, 256, 256)
        return new THREE.CanvasTexture(canvas)
      }

      // Create core sphere
      const geometry = new THREE.SphereGeometry(1, 64, 64)
      const material = new THREE.MeshPhysicalMaterial({
        color: 0x050a15,
        emissive: 0x020510,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.95,
        clearcoat: 1.0,
        clearcoatRoughness: 0.2
      })

      const sphere = new THREE.Mesh(geometry, material)
      sphereRef.current = sphere
      scene.add(sphere)

      // Add a thick glowing auras
      const auraTexCyan = createGlowTexture('rgba(0, 255, 255, 1)', 'rgba(0, 150, 255, 0.6)', 'rgba(0, 50, 150, 0.1)')
      const auraCyan = new THREE.Sprite(new THREE.SpriteMaterial({
        map: auraTexCyan,
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
      }))
      auraCyan.scale.set(3.2, 3.2, 1)
      auraCyan.userData.isAura = true
      auraCyan.userData.baseScale = 3.2
      sphere.add(auraCyan)

      const auraTexPurple = createGlowTexture('rgba(150, 100, 255, 0.8)', 'rgba(200, 50, 255, 0.4)', 'rgba(100, 0, 200, 0.1)')
      const auraPurple = new THREE.Sprite(new THREE.SpriteMaterial({
        map: auraTexPurple,
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
      }))
      auraPurple.scale.set(4.5, 4.5, 1)
      auraPurple.userData.isAura = true
      auraPurple.userData.baseScale = 4.5
      sphere.add(auraPurple)

      // Inner shell glow
      const shellGeometry = new THREE.SphereGeometry(1.02, 64, 64)
      const shellMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      })
      const shell = new THREE.Mesh(shellGeometry, shellMaterial)
      sphere.add(shell)

      // Face elements helper
      const createArc = (radius, tube, arc, color) => {
        // Use TubeGeometry along a curve for rounded ends
        class ArcCurve extends THREE.Curve {
          constructor(radius, arc) {
            super();
            this.radius = radius;
            this.arc = arc;
          }
          getPoint(t, optionalTarget = new THREE.Vector3()) {
            const angle = t * this.arc;
            return optionalTarget.set(
              Math.cos(angle) * this.radius,
              Math.sin(angle) * this.radius,
              0
            );
          }
        }
        const path = new ArcCurve(radius, arc)
        const geo = new THREE.TubeGeometry(path, 32, tube, 16, false)
        const mat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          blending: THREE.AdditiveBlending,
        })
        const mesh = new THREE.Mesh(geo, mat)
        // Center the geometry since the curve starts from X axis
        geo.center()
        return mesh
      }

      const eyeColor = 0xcceeff

      // Eyes (◠ ◠)
      const leftEye = createArc(0.12, 0.045, Math.PI, eyeColor)
      leftEye.position.set(-0.35, 0.1, 0.92)
      leftEye.userData.isEye = true
      sphere.add(leftEye)

      const rightEye = createArc(0.12, 0.045, Math.PI, eyeColor)
      rightEye.position.set(0.35, 0.1, 0.92)
      rightEye.userData.isEye = true
      sphere.add(rightEye)

      // Mouth (◡)
      const mouth = createArc(0.16, 0.045, Math.PI, eyeColor)
      mouth.position.set(0, -0.2, 0.94)
      mouth.rotation.set(0, 0, Math.PI) 
      mouthRef.current = mouth
      sphere.add(mouth)

      // HUD Face Rings
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
      })
      
      const faceRingGeo = new THREE.TorusGeometry(0.7, 0.012, 16, 100)
      const faceRing = new THREE.Mesh(faceRingGeo, ringMat)
      faceRing.position.set(0, 0, 0.72)
      sphere.add(faceRing)
      
      const dashedGeo = new THREE.TorusGeometry(0.8, 0.006, 16, 60, Math.PI * 1.5)
      const dashedRing = new THREE.Mesh(dashedGeo, ringMat)
      dashedRing.position.set(0, 0, 0.61)
      dashedRing.rotation.z = Math.PI / 4
      sphere.add(dashedRing)

      // Background Rings
      const createBgRing = (radius, tube, color, rotX, rotY, speed) => {
        const geo = new THREE.TorusGeometry(radius, tube, 16, 100)
        const mat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.3,
          blending: THREE.AdditiveBlending,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.rotation.set(rotX, rotY, 0)
        mesh.userData.speed = speed
        return mesh
      }

      const rings = new THREE.Group()
      ringsRef.current = rings
      rings.add(createBgRing(1.5, 0.005, 0x00ffff, Math.PI / 2.2, 0.1, 0.002))
      rings.add(createBgRing(1.9, 0.003, 0x0088ff, Math.PI / 1.8, -0.2, -0.001))
      rings.add(createBgRing(2.3, 0.008, 0xaa00ff, Math.PI / 2, 0.5, 0.003))
      scene.add(rings)

      // Particles
      const particlesGeo = new THREE.BufferGeometry()
      const pCount = 600
      const pPos = new Float32Array(pCount * 3)
      for (let i = 0; i < pCount * 3; i++) {
        pPos[i] = (Math.random() - 0.5) * 8
      }
      particlesGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
      const pMat = new THREE.PointsMaterial({
        size: 0.03,
        color: 0x88ffff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      })
      const particlesMesh = new THREE.Points(particlesGeo, pMat)
      particlesRef.current = particlesMesh
      scene.add(particlesMesh)

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
      scene.add(ambientLight)

      const pointLight1 = new THREE.PointLight(0x00ffff, 4, 10)
      pointLight1.position.set(2, 2, 3)
      scene.add(pointLight1)

      const pointLight2 = new THREE.PointLight(0xff00ff, 4, 10)
      pointLight2.position.set(-2, -2, 3)
      scene.add(pointLight2)
    }

    // Animation loop
    let time = 0
    const animate = () => {
      time += 0.01

      if (sphereRef.current) {
        sphereRef.current.position.y = Math.sin(time) * 0.05
        const baseScale = 0.75
        const pulse = baseScale + Math.sin(time * 2) * (0.01 * baseScale)
        sphereRef.current.scale.set(pulse, pulse, pulse)

        const targetRotY = mouseRef.current.x * 0.5
        const targetRotX = -mouseRef.current.y * 0.3

        sphereRef.current.rotation.y += (targetRotY - sphereRef.current.rotation.y) * 0.08
        sphereRef.current.rotation.x += (targetRotX - sphereRef.current.rotation.x) * 0.08
        sphereRef.current.rotation.y += 0.002

        if (mouthRef.current && analyserRef.current) {
          const frequency = analyserRef.current.getAverageFrequency()
          smoothFrequencyRef.current += (frequency - smoothFrequencyRef.current) * 0.2
          const sFreq = smoothFrequencyRef.current

          const mouthOpen = 1 + (sFreq / 80)
          mouthRef.current.scale.y = mouthOpen
          mouthRef.current.position.y = -0.2 - (sFreq / 600)
          
          sphereRef.current.children.forEach(child => {
            if (child.userData.isEye) {
              child.scale.y = 1 - (sFreq / 400)
            }
          })
        } else if (mouthRef.current) {
          smoothFrequencyRef.current *= 0.8
          mouthRef.current.scale.y += (1 - mouthRef.current.scale.y) * 0.1
          mouthRef.current.position.y += (-0.2 - mouthRef.current.position.y) * 0.1

          sphereRef.current.children.forEach(child => {
            if (child.userData.isEye) {
              child.scale.y += (1 - child.scale.y) * 0.1
            }
          })
        }

        if (isSpeaking && mouthRef.current) {
          const speakPulse = 1 + Math.sin(time * 15) * 0.3
          mouthRef.current.scale.y = speakPulse
          mouthRef.current.position.y = -0.25 - Math.sin(time * 10) * 0.05
        }

        sphereRef.current.children.forEach(child => {
          if (child.userData.isAura) {
            child.material.opacity = 0.6 + Math.sin(time * 3) * 0.2
            const auraPulse = child.userData.baseScale + Math.sin(time * 2) * 0.15
            child.scale.set(auraPulse, auraPulse, 1)
          }
        })
      }

      if (ringsRef.current) {
        ringsRef.current.children.forEach((ring, i) => {
          ring.rotation.z += (ring.userData.speed || 0.002)
          ring.rotation.x += Math.sin(time * 0.5 + i) * 0.002
        })
        ringsRef.current.rotation.y += 0.001
      }

      if (particlesRef.current) {
        particlesRef.current.rotation.y -= 0.0005
        particlesRef.current.position.y = Math.sin(time * 0.8) * 0.03
      }

      renderer.render(scene, camera)
    }
    
    renderer.setAnimationLoop(animate)

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', handleInteraction)
      }
      if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(null)
      }
      if (soundRef.current) {
        soundRef.current.stop()
      }
    }
  }, [isSpeaking])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    />
  )
}
