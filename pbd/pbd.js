//TODO: Remove anchor bodies and use an equality constraint?

function Length(dx, dy)
{
  return Math.sqrt(dx * dx + dy * dy);
}

function Body(x, y, mass)
{
  this.x = x;
  this.y = y;
  this.px = x;
  this.py = y;
  this.ax = 0;
  this.ay = 0;
  this.vx = 0;
  this.vy = 0;
  this.mass = mass;
  this.w = 1.0 / mass;
}

Body.prototype.SetMass = function(mass)
{
  this.w = 1.0 / mass;
}

Body.prototype.AddForce = function(fx, fy)
{
  this.ax = this.ax + fx / this.mass;
  this.ay = this.ay + fy / this.mass;
}

Body.prototype.AddAcceleration = function(ax, ay)
{
  this.ax = this.ax + ax;
  this.ay = this.ay + ay;
}

Body.prototype.UpdateVelocity = function(timeStep)
{
  this.vx = this.vx + this.ax * timeStep;
  this.vy = this.vy + this.ay * timeStep;
}

Body.prototype.IntegrateVelocity = function(timeStep)
{
  this.px = this.x + this.vx * timeStep;
  this.py = this.y + this.vy * timeStep;
}

Body.prototype.FinalizeState = function(timeStep)
{
  this.vx = (this.px - this.x) / timeStep;
  this.vy = (this.py - this.y) / timeStep;
  
  this.x = this.px;
  this.y = this.py;
}

Body.prototype.Draw = function(ctx)
{
  ctx.beginPath();
  ctx.arc(this.x, ctx.canvas.height - this.y, 4, 0, 360);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

function AnchorBody(x, y)
{
  this.x = x;
  this.y = y;
  this.px = x;
  this.py = y;
  this.ax = 0;
  this.ay = 0;
  this.vx = 0;
  this.vy = 0;
  this.mass = Infinity;
  this.w = 0;
}

AnchorBody.prototype = new Body();

AnchorBody.prototype.AddForce = function(fx, fy)
{
}

AnchorBody.prototype.AddAcceleration = function(ax, ay)
{
}

AnchorBody.prototype.UpdateVelocity = function(timeStep)
{
}

function Constraint()
{
}

Constraint.prototype.Project = function(px, py)
{
  return {x: 0, y: 0 };
}

Constraint.prototype.Draw = function(ctx)
{
}

function DistanceConstraint(k, body1, body2, distance)
{
  this.body1 = body1;
  this.body2 = body2;
  this.k = k;
  this.distance = distance;
}

DistanceConstraint.prototype = new Constraint();

DistanceConstraint.prototype.Project = function(numSolverIterations)
{
  var k = 1 - Math.pow(1 - this.k, 1 / numSolverIterations);

  var w1 = this.body1.w;
  var w2 = this.body2.w;
  
  var dx = this.body1.px - this.body2.px;
  var dy = this.body1.py - this.body2.py;
  var pMag = Length(dx, dy);
  
  var s = (pMag - this.distance) / pMag;
  var s1 = (-w1 / (w1 + w2)) * s
  var s2 = (w2 / (w1 + w2)) * s;
  
  var dpx1 = s1 * dx;
  var dpy1 = s1 * dy;
  
  var dpx2 = s2 * dx;
  var dpy2 = s2 * dy;
  
  this.body1.px = this.body1.px + dpx1 * k;
  this.body1.py = this.body1.py + dpy1 * k;
  
  this.body2.px = this.body2.px + dpx2 * k;
  this.body2.py = this.body2.py + dpy2 * k;
}

DistanceConstraint.prototype.Draw = function(ctx)
{
  var y1 = ctx.canvas.height - this.body1.y;
  var y2 = ctx.canvas.height - this.body2.y;
  var dx = this.body2.x - this.body1.x;
  var dy = y2 - y1;
  var mag = Length(dx, dy);
  var nx = dx / mag;
  var ny = dy / mag;
  ctx.beginPath();
  ctx.moveTo(this.body1.x + nx * 4, y1 + ny * 4);
  ctx.lineTo(this.body2.x - nx * 4, y2 - ny * 4);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

var g_frameNumber = 0;
var g_fps = 0;
var g_fpsCounterHandle;
var g_fpsCounterLastTimeMS;
var g_fpsCounterLastFrame;
var g_lastScheduledFrameHandle;
var g_lastFrameTimeMS;
var g_timeLeftOverLastFrame = 0;
var g_timeElapsed = 0;
var g_bodies = [];
var g_constraints = [];

function DampVelocities()
{
  
}

function Update(canvas, OnUpdateComplete)
{
  var now = Date.now();
  var ctx = canvas.getContext("2d");

  // Update physics
  var solverIterations = 3;
  var timeStep = 1 / 60;
  var deltaTime = 1e-3 * (now - g_lastFrameTimeMS) + g_timeLeftOverLastFrame;
  var numWholeSteps = Math.floor(deltaTime / timeStep);
  g_timeLeftOverLastFrame = deltaTime - numWholeSteps * timeStep;

  for (var step = 0; step < numWholeSteps; step++)
  {
    for (let body of g_bodies)
    {
      body.UpdateVelocity(timeStep); 
    }
    
    // DampVelocities();  <-- what about external constraints with w=0? Probably should not be included.
    
    for (let body of g_bodies)
    {
      body.IntegrateVelocity(timeStep);
    }

    for (var i = 0; i < solverIterations; i++)
    {
      for (let constraint of g_constraints)
      {
        constraint.Project(solverIterations);
      }
    }
    
    for (let body of g_bodies)
    {
      body.FinalizeState(timeStep);
    }

    g_timeElapsed += timeStep;
  }

  // Render
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '16px serif';
  ctx.fillStyle = "#000";
  ctx.fillText(g_fps.toFixed(1), 20, 20);

  for (let body of g_bodies)
  {
    body.Draw(ctx);
  }

  for (let constraint of g_constraints)
  {
    constraint.Draw(ctx);
  }
  
  // Callback
  OnUpdateComplete(ctx);

  // Schedule next frame
  g_lastFrameTimeMS = now;
  g_frameNumber += 1;
  g_lastScheduledFrameHandle = window.requestAnimationFrame(function() { Update(canvas, OnUpdateComplete) });
}

function UpdateFPS()
{
  var now = Date.now();
  var frameNumber = g_frameNumber;
  g_fps = (frameNumber - g_fpsCounterLastFrame) / (1e-3 * (now - g_fpsCounterLastTimeMS));
  g_fpsCounterLastTimeMS = now;
  g_fpsCounterLastFrame = frameNumber;
}

function FindObjectAt(x, y)
{
  for (var i = 0; i < g_bodies.length; i++)
  {
    if (g_bodies[i].Selected(x, y))
      return g_bodies[i];
  }
  return null;
}

function PBDAddBody(body)
{
  g_bodies.push(body);
}

function PBDAddConstraint(constraint)
{
  g_constraints.push(constraint);
}

function PBDStart(OnUpdateComplete)
{
  var canvas = document.getElementById("Viewport");
  g_lastFrameTimeMS = Date.now();
  Update(canvas, OnUpdateComplete);
  if (!g_fpsCounterHandle)
  {
    g_fpsCounterHandle = window.setInterval(UpdateFPS, 1000);
    g_fpsCounterLastTimeMS = Date.now();
    g_fpsCounterLastFrame = g_frameNumber;
  }
}

function VerletStop()
{
  if (g_lastScheduledFrameHandle)
    window.cancelAnimationFrame(g_lastScheduledFrameHandle);
}