import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import * as CANNON from "cannon-es"
import Stats from "stats.js"
import { AmbientLight } from "three"
import { World } from "cannon-es"

import myMatcap from "../matcaps/eva01-3.png"

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

    /**
     * Scene
     */
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color("gray")
    this.scene.add(new THREE.GridHelper(20, 40))

    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight

    /**
     * Camera
     */
    this.camera = new THREE.PerspectiveCamera(
      75,
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
        // displayValues(e, "keydown");
      })
    })

    this.resize()
    this.setupResize()
    this.addLights()
    this.addObjects()

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

    //Floor CANNON
    this.cFloorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
    })
    this.cFloorBody.quaternion.setFromEuler(-Math.PI * 0.5, 0, 0)
    this.world.addBody(this.cFloorBody)

    this.scene.add(this.floor)
  }

  addLetter(e) {
    /**
     * Fonts
     */
    const fontLoader = new THREE.FontLoader()

    const TEXT = e.key == " " ? "SpaceBar" : e.key

    fontLoader.load("helvetiker_regular.typeface.json", (font) => {
      const textGeometry = new THREE.TextBufferGeometry(TEXT, {
        font: font,
        size: 1,
        height: 0.5,
        curveSegments: 5,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.05,
        bevelOffset: 0,
        bevelSegments: 5,
      })
      textGeometry.center()
      const size = textGeometry.boundingBox.getSize(new THREE.Vector3())

      const material = new THREE.MeshMatcapMaterial({
        matcap: this.matcapTexture,
      })
      const mesh = new THREE.Mesh(textGeometry, material)
      mesh.position.y = 0.5
      mesh.castShadow = true

      this.scene.add(mesh)

      //Test CANNON
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
    this.light = new THREE.AmbientLight(0xfffff, 0.3)

    this.directionalLight = new THREE.DirectionalLight(0x00ffff, 1)
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

    // Update controls
    this.controls.update()

    this.renderer.render(this.scene, this.camera)

    // this.renderer.shadowMap.enabled = true
    window.requestAnimationFrame(this.render.bind(this))

    this.stats.end()
  }
}

new Sketch({
  dom: document.getElementById("container"),
})
