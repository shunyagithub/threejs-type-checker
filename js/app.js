import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import * as CANNON from "cannon-es"
import gsap from "gsap"
import Stats from "stats.js"
import { AmbientLight } from "three"
import { World } from "cannon-es"

import myMatcap from "../matcaps/eva01-3.png"
import myModel from "../models/pc.glb"
import envPx from "../img/envmaps/0/px.png"
import envNx from "../img/envmaps/0/nx.png"
import envPy from "../img/envmaps/0/py.png"
import envNy from "../img/envmaps/0/ny.png"
import envPz from "../img/envmaps/0/pz.png"
import envNz from "../img/envmaps/0/nz.png"

export default class Sketch {
  constructor(options) {
    this.clock = new THREE.Clock()
    this.oldElapsedTime = 0
    this.container = options.dom

    /**
     *
     * Stats
     */
    this.stats = new Stats()
    this.stats.showPanel(0)
    document.body.appendChild(this.stats.dom)

    /**
     * Textures
     */
    this.textureLoader = new THREE.TextureLoader()
    this.matcapTexture = this.textureLoader.load(myMatcap)

    /**
     * Utils
     */
    this.objectToUpdate = []
    this.textOnSide = null

    //keys
    this.keysObjcts = null

    /**
     * Scene
     */
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color("gray")
    this.scene.add(new THREE.GridHelper(20, 40))

    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight

    //Update materials
    this.updateAllMaterials = () => {
      this.scene.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshStandardMaterial
        ) {
          child.material.envMapIntensity = Object.envMapIntensity
          child.castShadow = true
          child.receiveShadow = true
        }
      })
    }

    //envMap
    const cubeTextureLoader = new THREE.CubeTextureLoader()
    this.enviromentMap = cubeTextureLoader.load([
      envPx,
      envNx,
      envPy,
      envNy,
      envPz,
      envNz,
    ])
    this.enviromentMap.encoding = THREE.sRGBEncoding
    this.scene.environment = this.enviromentMap
    this.objectToUpdate.envMapIntensity = 5

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
    this.camera.position.set(0, 0.5, 5)

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
        restitution: 0.6, //bounce def .3
      }
    )
    this.world.addContactMaterial(this.defaultContactMaterial)
    this.world.defaultContactMaterial = this.defaultContactMaterial //Body.materialに書く必要がなくなる

    /**
     * Renderer
     */
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.container.appendChild(this.renderer.domElement)

    /**
     * Controls
     */
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true

    document.addEventListener("DOMContentLoaded", () => {
      // displayValues({}, "keydown");

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
          duration: 0.2,
          ease: "power2.inOut",
        })

        // displayValues(e, "keydown");
      })
    })

    this.resize()
    this.setupResize()
    this.addLights()
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
      color: "white",
    })
    this.floor = new THREE.Mesh(this.floorGeo, this.material)
    this.floor.receiveShadow = true

    this.scene.add(this.floor)

    //Floor CANNON
    this.cFloorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
    })
    this.cFloorBody.quaternion.setFromEuler(-Math.PI * 0.5, 0, 0)
    this.world.addBody(this.cFloorBody)

    //Display
    this.displayGeo = new THREE.PlaneBufferGeometry(0.8, 0.5)
    this.displayMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
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

    this.updateAllMaterials()
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
        height: 0.5,
        curveSegments: 5,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelOffset: 0,
        bevelSegments: 5,
      })

      const keyCodeGeometry = new THREE.TextBufferGeometry(KEYCODE, {
        font: font,
        size: 1,
        height: 0.1,
        curveSegments: 5,
        bevelEnabled: true,
        bevelThickness: 0.05,
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
      mesh.castShadow = true

      this.scene.add(mesh)

      //show key and keyCode
      const textSide = new THREE.Mesh(keyNameGeometry, material)
      textSide.position.set(-1.2, 0.4, 3.1)
      textSide.scale.set(0.3, 0.3, 0.3)
      textSide.name = "textSide"
      this.textOnSide = textSide

      const keyCode = new THREE.Mesh(keyCodeGeometry, material)
      keyCode.position.set(0, 0.75, 3)
      keyCode.scale.set(0.25, 0.25, 0.25)
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

  addLights() {
    this.light = new THREE.AmbientLight(0xffffff, 1)

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    this.directionalLight.position.set(2, 2, 2)
    this.directionalLight.castShadow = true
    this.directionalLight.shadow.camera.far = 6
    this.directionalLight.shadow.mapSize.set(1024, 1024)
    this.scene.add(this.light, this.directionalLight)

    //helper
    const directionalLightCameraHelper = new THREE.CameraHelper(
      this.directionalLight.shadow.camera
    )
    // this.scene.add(directionalLightCameraHelper)
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
}

new Sketch({
  dom: document.getElementById("container"),
})
