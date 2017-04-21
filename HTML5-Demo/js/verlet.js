/*
 * verlet.js
 * Bart Trzynadlowski
 * 2017.04.20
 *
 * Verlet integrator-based physics engine.
 */

function Length(dx, dy)
{
  return Math.sqrt(dx * dx + dy * dy);
}

function PinConstraint(body, x, y)
{
  this.priority = 0;  // highest priority (applied last)
  this.body = body;
  this.x = x;
  this.y = y;
}

PinConstraint.prototype.Solve = function(body)
{
  this.body.x = this.x;
  this.body.y = this.y;
}

PinConstraint.prototype.Draw = function(ctx)
{
  ctx.beginPath();
  ctx.arc(this.x, ctx.canvas.height - this.y, 4, 0, 360);
  ctx.fillStyle = "#f00";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

function LinkConstraint(body1, body2, length, stiffness)
{
  this.priority = 1;
  this.body1 = body1;
  this.body2 = body2;
  this.maxLength = length;
  this.stiffness = stiffness;
}

LinkConstraint.prototype.Solve = function()
{
  var dx = this.body1.x - this.body2.x;
  var dy = this.body1.y - this.body2.y;
  var distance = Length(dx, dy);
  var p1 = this.body2.mass / (this.body1.mass + this.body2.mass);
  var p2 = this.body1.mass / (this.body1.mass + this.body2.mass);
  var adjustment1 = this.stiffness * p1 * (distance - this.maxLength);
  var adjustment2 = this.stiffness * p2 * (distance - this.maxLength);
  this.body1.x -= adjustment1 * (dx / distance);
  this.body1.y -= adjustment1 * (dy / distance);
  this.body2.x += adjustment2 * (dx / distance);
  this.body2.y += adjustment2 * (dy / distance);
}

LinkConstraint.prototype.Draw = function(ctx)
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

function PointMass(x, y, mass)
{
  this.x = x;
  this.y = y;
  this.lastX = x;
  this.lastY = y;
  this.mass = mass;
  this.ax = 0;
  this.ay = 0;
  this.constraints = [];
}

PointMass.prototype.Update = function(deltaTime)
{
  // Simple Verlet integration  
  var deltaTime2 = deltaTime * deltaTime;
  //var vx = (this.x - this.lastX) / deltaTime;
  //var vy = (this.y - this.lastY) / deltaTime;
  var nextX = this.x + (this.x - this.lastX) + this.ax * deltaTime2;
  var nextY = this.y + (this.y - this.lastY) + this.ay * deltaTime2;
  this.lastX = this.x;
  this.lastY = this.y;
  this.x = nextX;
  this.y = nextY;
  
  // Velocity Verlet integration (requires vx and vy state variables)
  /*
  var deltaTime2 = deltaTime * deltaTime;
  var nextX = this.x + this.vx * deltaTime + 0.5 * this.ax * deltaTime2;
  var nextY = this.y + this.vy * deltaTime + 0.5 * this.ay * deltaTime2;
  var nextVX = this.vx + this.ax * deltaTime;
  var nextVY = this.vy + this.ay * deltaTime;
  this.lastX = this.x;
  this.lastY = this.y;
  this.x = nextX;
  this.y = nextY;
  this.vx = nextVX;
  this.vy = nextVY;
  */
}

PointMass.prototype.Draw = function(ctx)
{
  ctx.beginPath();
  ctx.arc(this.x, ctx.canvas.height - this.y, 4, 0, 360);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

PointMass.prototype.Selected = function(x, y)
{
  var dx = this.x - x;
  var dy = this.y - y;
  var length = Length(dx, dy);
  return length <= 10;
}

PointMass.prototype.AddForce = function(fx, fy)
{
  this.ax = this.ax + fx / this.mass;
  this.ay = this.ay + fy / this.mass;
}

PointMass.prototype.AddConstraint = function(constraint)
{
  this.constraints.push(constraint);
  this.constraints.sort(
    function(a, b)
    {
      // Higher priority (lower number) pushed to end of array
      return b.priority - a.priority;
    });
}

PointMass.prototype.RemoveConstraint = function(constraint)
{
  var idx;
  while ((idx = this.constraints.indexOf(constraint)) >= 0)
  {
    this.constraints.splice(idx, 1);
  }
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
var g_objects = [];

function Update(canvas, OnUpdateComplete)
{
  var now = Date.now();
  var ctx = canvas.getContext("2d");

  // Update physics
  var constraintIterations = 3;
  var timeStep = 1 / 60;
  var deltaTime = 1e-3 * (now - g_lastFrameTimeMS) + g_timeLeftOverLastFrame;
  var numWholeSteps = Math.floor(deltaTime / timeStep);
  g_timeLeftOverLastFrame = deltaTime - numWholeSteps * timeStep;
  for (var step = 0; step < numWholeSteps; step++)
  {
    for (var j = 0; j < constraintIterations; j++)
    {
      for (var i = 0; i < g_objects.length; i++)
      {
        for (let constraint of g_objects[i].constraints)
        {
          constraint.Solve();
        }
      }
    }
    for (var i = 0; i < g_objects.length; i++)
    {
      g_objects[i].Update(timeStep);
    }
    g_timeElapsed += timeStep;
  }

  // Render
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '16px serif';
  ctx.fillStyle = "#000";
  ctx.fillText(g_fps.toFixed(1), 20, 20);
  for (var i = 0; i < g_objects.length; i++)
  {
    g_objects[i].Draw(ctx);
  }
  for (var i = 0; i < g_objects.length; i++)
  {
    for (var j = 0; j < g_objects[i].constraints.length; j++)
    {
      g_objects[i].constraints[j].Draw(ctx);
    }
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
  for (var i = 0; i < g_objects.length; i++)
  {
    if (g_objects[i].Selected(x, y))
      return g_objects[i];
  }
  return null;
}

function VerletAddObject(obj)
{
  g_objects.push(obj);
}

function VerletStart(OnUpdateComplete)
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