import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import * as CANNON from "cannon-es"
import gsap from "gsap"
import Stats from "stats.js"
import * as dat from "dat.gui"
import cannonDebugger from "cannon-es-debugger"

import myMatcap from "../img/matcaps/3.png"
import myModel from "../models/pc2.glb"

export default class Sketch {
  constructor(options) {
    /**
     *
     * Stats
     */
    this.stats = new Stats()
    this.stats.showPanel(0)
    // document.body.appendChild(this.stats.dom)

    /**
     * Textures
     */
    this.textureLoader = new THREE.TextureLoader()
    this.matcapTexture = this.textureLoader.load(myMatcap)

    /**
     * Utils
     */
    this.container = options.dom

    this.clock = new THREE.Clock()
    this.oldElapsedTime = 0
    this.objectToUpdate = []

    //keys
    this.textOnSide = null
    this.keysObjcts = null

    /**
     * Scene
     */
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000000)
    this.scene.add(new THREE.GridHelper(20, 40, "green", "green"))

    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight

    /**
     * Camera
     */
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.width / this.height,
      0.01,
      100
    )
    this.camera.updateProjectionMatrix()
    this.camera.position.set(0, 1, 6)

    /**
     * Cannon
     */
    this.world = new CANNON.World()
    this.world.gravity.set(0, -9.82, 0)
    this.world.allowSleep = true

    // Material
    this.defaultMaterial = new CANNON.Material("default")

    this.defaultContactMaterial = new CANNON.ContactMaterial(
      this.defaultMaterial,
      this.defaultMaterial,
      {
        friction: 0.1,
        restitution: 0.1, //bounce def .3
      }
    )
    this.world.addContactMaterial(this.defaultContactMaterial)
    this.world.defaultContactMaterial = this.defaultContactMaterial //Body.materialに書く必要がなくなる

    /**
     * Renderer
     */
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.container.appendChild(this.renderer.domElement)

    /**
     * Controls
     */
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true

    /**
     * Press Keys
     */
    document.addEventListener("keydown", (e) => {
      this.addLetter(e)

      //press random key
      this.randomNum = gsap.utils.random(0, 22, 1)
      this.keys = this.keysObjcts.slice(4, 27)
      this.randomKey = this.keys[this.randomNum]

      gsap.to(this.randomKey.position, {
        y: -0.001,
        repeat: 1,
        yoyo: true,
        duration: 0.02,
        ease: "power2.inOut",
      })
    })

    // this.debug()
    this.resize()
    this.setupResize()
    // this.addLights()
    this.addFog()
    this.addObjects()
    this.addModels()
    this.render()
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this))
  }
  resize() {
    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight
    this.renderer.setSize(this.width, this.height)
    this.camera.aspect = this.width / this.height
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    this.camera.updateProjectionMatrix()
  }

  addObjects() {
    //Floor
    this.floorGeo = new THREE.PlaneBufferGeometry(20, 20)
    this.floorGeo.rotateX(-Math.PI * 0.5)
    this.material = new THREE.MeshBasicMaterial({
      color: 0x000000,
    })
    this.floor = new THREE.Mesh(this.floorGeo, this.material)

    this.scene.add(this.floor)

    //Floor CANNON
    this.cFloorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
    })
    this.cFloorBody.quaternion.setFromEuler(-Math.PI * 0.5, 0, 0)
    this.world.addBody(this.cFloorBody)

    //Display
    this.displayGeo = new THREE.PlaneBufferGeometry(0.8, 0.6)
    this.displayMaterial = new THREE.MeshBasicMaterial({
      color: "green",
      transparent: true,
      opacity: 0.2,
    })
    this.display = new THREE.Mesh(this.displayGeo, this.displayMaterial)
    this.display.position.set(0, 0.75, 2.97)
    this.display.rotation.x = -Math.PI * 0.02
    this.scene.add(this.display)
  }

  addModels() {
    /**
     * Models
     */
    const gltfLoader = new GLTFLoader()

    gltfLoader.load(myModel, (gltf) => {
      gltf.scene.scale.set(0.5, 0.5, 0.5)
      gltf.scene.position.set(0, 0, 2.5)
      this.scene.add(gltf.scene)

      this.keysObjcts = gltf.scene.children
    })

    //PC CANNON
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(0.7, 1.2, 0.7)),
      material: this.defaultMaterial,
    })
    body.position.set(0, 0, 2.5)
    this.world.addBody(body)

    //SIDE CANNON
    const side = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
      material: this.defaultMaterial,
    })
    side.position.set(-1.1, 0, 3.2)
    this.world.addBody(side)
  }

  addLetter(e) {
    // console.log(e)
    /**
     * Fonts
     */
    const fontLoader = new THREE.FontLoader()

    const KEYNAME = e.key === " " ? "Space" : e.key
    const KEYCODE = e.keyCode.toString()

    // const

    fontLoader.load("helvetiker_regular.typeface.json", (font) => {
      const keyNameGeometry = new THREE.TextBufferGeometry(KEYNAME, {
        font: font,
        size: 1,
        height: 0.4,
        curveSegments: 5,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.07,
        bevelOffset: 0,
        bevelSegments: 5,
      })

      const keyCodeGeometry = new THREE.TextBufferGeometry(KEYCODE, {
        font: font,
        size: 1,
        height: 0.3,
        curveSegments: 3,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.05,
        bevelOffset: 0,
        bevelSegments: 5,
      })
      keyNameGeometry.center()
      keyCodeGeometry.center()

      const size = keyNameGeometry.boundingBox.getSize(new THREE.Vector3()) //get size for cannon body
      const material = new THREE.MeshMatcapMaterial({
        matcap: this.matcapTexture,
      })
      const mesh = new THREE.Mesh(keyNameGeometry, material)
      mesh.position.y = 0.5
      // mesh.castShadow = true
      mesh.name = "key"
      this.scene.add(mesh)

      //show key and keyCode
      const textSide = new THREE.Mesh(keyNameGeometry, material)
      textSide.position.set(-1.13, 0.4, 3.15)
      textSide.scale.set(0.2, 0.2, 0.2)
      textSide.name = "textSide"
      this.textOnSide = textSide

      const keyCode = new THREE.Mesh(keyCodeGeometry, material)
      keyCode.position.set(0, 0.77, 2.8)
      keyCode.scale.set(0.28, 0.28, 0.28)
      this.scene.add(keyCode)
      keyCode.name = "keyCode"

      const selectedObject = []
      selectedObject.push(this.scene.getObjectByName("textSide"))
      selectedObject.push(this.scene.getObjectByName("keyCode"))
      for (let i = 0; i < selectedObject.length; i++) {
        this.scene.remove(selectedObject[i]) //remove text on the side
      }

      this.scene.add(textSide, keyCode)

      //Text CANNON
      const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(size.multiplyScalar(0.5)),
        material: this.defaultMaterial,
      })
      body.position.set(Math.random(), 5, Math.random())
      body.quaternion.setFromEuler(
        0,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      )
      this.world.addBody(body)

      // save in objects to update
      this.objectToUpdate.push({
        mesh,
        body,
      })
    })
  }

  removeLetter() {
    // console.log(this.objectToUpdate)
    this.scene.remove(this.scene.getObjectByName("key"))
    this.world.removeBody(this.objectToUpdate[0].body)
    this.objectToUpdate.shift()
  }

  addLights() {
    this.light = new THREE.AmbientLight(0xffffff, 0.3)

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
    this.directionalLight.position.set(2, 2, 2)
    // this.directionalLight.castShadow = true
    // this.directionalLight.shadow.camera.far = 6
    // this.directionalLight.shadow.mapSize.set(1024, 1024)
    this.scene.add(this.light, this.directionalLight)

    //helper
    const directionalLightCameraHelper = new THREE.CameraHelper(
      this.directionalLight.shadow.camera
    )
    this.scene.add(directionalLightCameraHelper)
    directionalLightCameraHelper.visible = false
  }

  addFog() {
    const fog = new THREE.Fog(0x050505, 5, 8)
    this.scene.fog = fog
  }

  /**
   * Animate
   */

  render() {
    this.stats.begin()

    const elapsedTime = this.clock.getElapsedTime()
    const deltaTime = elapsedTime - this.oldElapsedTime
    this.oldElapsedTime = elapsedTime

    //World
    this.world.step(1 / 60, deltaTime, 3)

    //remove letter
    if (this.objectToUpdate.length > 50) {
      this.removeLetter()
    }

    for (const object of this.objectToUpdate) {
      object.mesh.position.copy(object.body.position)
      object.mesh.quaternion.copy(object.body.quaternion)
    }

    if (this.textOnSide) {
      this.textOnSide.rotation.y = elapsedTime
    }

    // Update controls
    this.controls.update()

    this.renderer.render(this.scene, this.camera)
    window.requestAnimationFrame(this.render.bind(this))

    this.stats.end()
  }

  debug() {
    /**
     * Debug
     */
    //Cannon
    this.cannonDebugRenderer = cannonDebugger(this.scene, this.world.bodies)

    //GUI
    const gui = new dat.GUI({ closed: true })

    const parameters = {
      bgColor: 0xffffff,
      floorColor: 0xffffff,
    }

    //colors
    gui
      .addColor(parameters, "bgColor")
      .onChange(() => [
        (this.scene.background = new THREE.Color(parameters.bgColor)),
      ])

    gui
      .addColor(parameters, "floorColor")
      .onChange(() => [this.material.color.set(parameters.floorColor)])
  }
}

new Sketch({
  dom: document.getElementById("container"),
})
