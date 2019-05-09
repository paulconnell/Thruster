class World {
    readonly gravity: Math2d.Vector
    readonly toScreen: Math2d.Matrix
    shapes: Shape[]

    constructor() {
        this.gravity = Math2d.Vector.create(0, -.02)
        this.toScreen = Math2d.createRotationAndTranslationMatrixRadians(
            Math.PI, //rotate to make +ve Y be upwards
            Math2d.Vector.create(80, 60)) //translate to screen center
        this.shapes = []
    }

    public add(s: Shape) {
        s.sceneIndex = this.shapes.length
        this.shapes.insertAt(s.sceneIndex, s)
    }

    public remove(s: Shape) {
        this.shapes.removeAt(s.sceneIndex)
        s.sceneIndex = -1
    }

    public update(): void {
        for (let i = 0; i < this.shapes.length; i++) {
            this.shapes[i].update()
        }
    }

    public render(img: Image): void {
        for (let i = 0; i < this.shapes.length; i++) {
            this.shapes[i].render(img)
        }
    }
}
let world = new World()

class Shape {
    points: Math2d.Vector[]
    renderPoints: Math2d.Vector[]
    worldPos: Math2d.Vector
    xform: Math2d.Matrix
    sceneIndex: number

    public constructor() {
        this.sceneIndex = -1
        this.renderPoints = []
        this.worldPos = Math2d.Vector.zero()
        this.xform = Math2d.Matrix.identity()
    }

    public update() {
        for (let i = 0; i < 4; i++) {
            let point = this.xform.apply(this.points[i])
            point = point.add(this.worldPos)
            point = world.toScreen.apply(point)
            this.renderPoints[i] = point
        }
    }

    public render(i: Image) {
        for (let j = 0; j < this.points.length - 1; j++) {
            this.drawLine(i, j, j + 1)
        }
        this.drawLine(i, this.points.length - 1, 0)
    }

    private drawLine(i: Image, f: number, t: number) {
        i.drawLine(
            this.renderPoints[f].getX(), this.renderPoints[f].getY(),
            this.renderPoints[t].getX(), this.renderPoints[t].getY(),
            2)
    }
}

class Craft extends Shape {
    readonly maxDownSpeed: number
    readonly maxAirSpeed: number
    readonly maxAirSpeedSq: number
    readonly maxAccel: number
    readonly maxAccelSq: number

    readonly effectSprite: Sprite

    heading: Math2d.Vector
    vel: Math2d.Vector
    thrust: Math2d.Vector

    thrusting: boolean
    beganThrusting: boolean
    stoppedThrusting: boolean

    constructor() {
        super()

        this.points = [
            Math2d.Vector.create(0, 8),
            Math2d.Vector.create(4, 0),
            Math2d.Vector.create(0, -2),
            Math2d.Vector.create(-4, 0),
        ]

        this.maxDownSpeed = -.5
        this.maxAirSpeed = .8
        this.maxAccel = 0.04
        this.maxAirSpeedSq = this.maxAirSpeed * this.maxAirSpeed
        this.maxAccelSq = this.maxAccel * this.maxAccel
        this.heading = Math2d.Vector.create(0, 1)
        this.vel = Math2d.Vector.zero()
        this.thrust = Math2d.Vector.zero()

        this.effectSprite = sprites.create(image.create(0, 0))

        this.thrusting = this.beganThrusting = this.stoppedThrusting = false
    }

    private calcVelocity(): Math2d.Vector {
        let accel = this.thrust.add(world.gravity)
        let newVel = this.vel.add(accel)

        if (newVel.getY() < this.maxDownSpeed) {
            newVel.setY(this.maxDownSpeed)
        }

        if (newVel.magSquared() > this.maxAirSpeedSq) {
            newVel.normalize()
            newVel = newVel.scale(this.maxAirSpeed)
        }

        return newVel
    }

    private bounceOffSides(pos: Math2d.Vector, vel: Math2d.Vector): Math2d.Vector {
        let maybePos = pos.add(vel)
        let impulse = Math2d.Vector.zero()
        if (maybePos.getX() > 76) {
            impulse.setX(-this.maxAirSpeed)
        } else if (maybePos.getX() < -76) {
            impulse.setX(this.maxAirSpeed)
        }
        if (maybePos.getY() > 56) {
            impulse.setY(-this.maxAirSpeed)
        } else if (maybePos.getY() < -56) {
            impulse.setY(this.maxAirSpeed)
        }
        impulse.normalize()
        impulse = impulse.scale(this.maxAirSpeed)
        return impulse
    }

    private updateEffects(): void {
        if (this.beganThrusting) {
            this.effectSprite.startEffect(effects.trail)
        } else if (this.stoppedThrusting) {
            effects.clearParticles(this.effectSprite)
        }

        this.beganThrusting = false
        this.stoppedThrusting = false
    }

    private handleInput(): void {
        if (controller.A.isPressed()) {
            this.applyThrust()
        } else {
            this.releaseThrust()
        }

        let sign = 0
        if (controller.left.isPressed()) {
            sign = -1
        } else if (controller.right.isPressed()) {
            sign = 1
        }

        let rotate = Math2d.createRotationMatrixDegrees(sign * 1.5)
        this.xform = this.xform.mul(rotate)
    }

    private applyThrust() {
        if (!this.thrusting) {
            this.beganThrusting = true
        }
        //need better ramp up and cool down for the thrust
        this.thrust = this.heading.scale(0.08)
        this.thrusting = true;
    }

    private releaseThrust() {
        if (this.thrusting) {
            this.stoppedThrusting = true
        }
        this.thrust = this.thrust.scale(.6)
        this.thrusting = false
    }

    public update(): void {
        super.update()

        this.handleInput()

        let pos = this.worldPos
        let newVel = this.calcVelocity()
        let impulse = this.bounceOffSides(pos, newVel)
        newVel = newVel.add(impulse)
        pos = pos.add(newVel)
        this.updateEffects()

        this.vel = newVel
        this.worldPos = pos
        this.heading = this.xform.apply(Math2d.Vector.create(0, 1))
    }

    public render(i: Image) {
        super.render(i)
        let screenPos = world.toScreen.apply(this.worldPos.sub(this.heading.scale(8)))
        Math2d.setSpritePosition(this.effectSprite, screenPos)
    }
}

let view = image.create(screen.width, screen.height)
let render = sprites.create(view)
effects.starField.startScreenEffect()
world.add(new Craft())

game.onPaint(function () {
    world.render(view)
})

game.onUpdate(function () {
    view.fillRect(0, 0, screen.width, screen.height, 0)
    world.update()
})
