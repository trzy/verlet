/*
 * engine.js
 * Bart Trzynadlowski, 2020
 *
 * Manages canvas rendering at a variable frame rate and physics simulation at
 * a fixed time step.
 */

function Engine(physicsSystem)
{
  this.physicsEnabled = false;
  this.runPhysicsSteps = 0; // used when physics are disabled

  var m_physicsSystem = physicsSystem

  var m_frameNumber = 0;
  var m_fps = 0;
  var m_fpsCounterHandle;
  var m_fpsCounterLastTimeMS;
  var m_fpsCounterLastFrame;
  var m_lastScheduledFrameHandle;
  var m_lastFrameTimeMS;
  var m_timeLeftOverLastFrame = 0;

  var self = this;

  function UpdateFPS()
  {
    var now = Date.now();
    var frameNumber = m_frameNumber;
    m_fps = (frameNumber - m_fpsCounterLastFrame) / (1e-3 * (now - m_fpsCounterLastTimeMS));
    m_fpsCounterLastTimeMS = now;
    m_fpsCounterLastFrame = frameNumber;
  }

  function Update(canvas, OnUpdateComplete)
  {
    var now = Date.now();
    var ctx = canvas.getContext("2d");

    // Update physics
    var timeStep = 1 / 60;
    var timeSinceLastFrameMS = Math.min(1000, now - m_lastFrameTimeMS); // clamp to handle case where we hide tab and too much time elapses
    var deltaTime = 1e-3 * timeSinceLastFrameMS + m_timeLeftOverLastFrame;
    var numWholeSteps = Math.floor(deltaTime / timeStep);
    m_timeLeftOverLastFrame = deltaTime - numWholeSteps * timeStep;

    if (m_physicsSystem)
    {
      numWholeSteps = self.physicsEnabled ? numWholeSteps : self.runPhysicsSteps;

      for (var step = 0; step < numWholeSteps; step++)
      {
        m_physicsSystem.Update(timeStep);
      }

      if (!self.physicsEnabled)
      {
        self.runPhysicsSteps = 0;
      }
    }

    // Render
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px serif';
    ctx.fillStyle = "#000";
    ctx.fillText(m_fps.toFixed(1), 20, 20);

    if (m_physicsSystem)
    {
      for (let drawable of m_physicsSystem.Drawables())
      {
        drawable.Draw(ctx);
      }
    }

    // Callback
    OnUpdateComplete(ctx);

    // Schedule next frame
    m_lastFrameTimeMS = now;
    m_frameNumber += 1;
    m_lastScheduledFrameHandle = window.requestAnimationFrame(function() { Update(canvas, OnUpdateComplete) });
  }

  this.Start = function(OnUpdateComplete)
  {
    var canvas = document.getElementById("Viewport");
    m_lastFrameTimeMS = Date.now();
    Update(canvas, OnUpdateComplete);
    if (!m_fpsCounterHandle)
    {
      m_fpsCounterHandle = window.setInterval(UpdateFPS, 1000);
      m_fpsCounterLastTimeMS = Date.now();
      m_fpsCounterLastFrame = m_frameNumber;
    }
  }

  this.Stop = function()
  {
    if (m_lastScheduledFrameHandle)
    {
      window.cancelAnimationFrame(m_lastScheduledFrameHandle);
      m_lastScheduledFrameHandle = undefined;
    }

    if (m_fpsCounterHandle)
    {
      window.clearInterval(m_fpsCounterHandle);
      m_fpsCounterHandle = undefined;
    }
  }
}