function Engine()
{
  this.physicsEnabled = false;
  this.physicsSolverIterations = 3;
  
  var m_frameNumber = 0;
  var m_fps = 0;
  var m_fpsCounterHandle;
  var m_fpsCounterLastTimeMS;
  var m_fpsCounterLastFrame;
  var m_lastScheduledFrameHandle;
  var m_lastFrameTimeMS;
  var m_timeLeftOverLastFrame = 0;
  var m_physicsTimeElapsed = 0;
  var m_vertices = [];
  var m_constraints = [];
  
  var self = this;
  
  function DampVelocities(kDamping)
  {
    // Exclude vertices with non-finite mass (e.g., anchor vertices) or w == 0, which are not
    // part of the dynamic body
    var vertices = m_vertices.filter(vertex => vertex.w != 0 && isFinite(vertex.mass));

    var mass = vertices.reduce((sum, vertex) => sum + vertex.mass, 0);
    var w = 1.0 / mass;

    var xcm = Mult(w, vertices.reduce((sum, vertex) => Add(sum, Mult(vertex.mass, vertex.Position())), Vector3.Zero()));  // xcm = Sum(x_i * m_i) / Sum(m_i)
    var vcm = Mult(w, vertices.reduce((sum, vertex) => Add(sum, Mult(vertex.mass, vertex.Velocity())), Vector3.Zero()));  // vcm = Sum(v_i * m_i) / Sum(m_i)

    var r = [];
    for (let vertex of vertices)
    {
      r.push(Sub(vertex.Position(), xcm));
    }

    var L = Vector3.Zero();
    for (var i = 0; i < r.length; i++)
    {
      var Li = Cross(r[i], Mult(vertices[i].mass, vertices[i].Velocity()));
      L = Add(L, Li);
    }

    var I = Matrix3.Zero();
    for (var i = 0; i < r.length; i++)
    {
      var r$ = r[i].CrossMatrix();
      var rrt = Mult(r$, r$.Transpose());
      var Ii = Mult(vertices[i].mass, rrt);
      I = Add(I, Ii);
    }

    var Iinv = I.Inverse();
    var omega = Mult(Iinv, L);

    for (var i = 0; i < r.length; i++)
    {
      // TODO: when deltaVcm == 0, Iinv matrix does not exist and we should have vi unaffected
      var deltaVcm = Sub(vcm, vertices[i].Velocity());
      var deltaVangular = Cross(omega, r[i]);
      var deltaV = Add(deltaVcm, deltaVangular);
      var newVelocity = Add(vertices[i].Velocity(), Mult(kDamping, deltaV));
      vertices[i].SetVelocity(newVelocity);
    }
  }
  
  function UpdatePhysics(timeStep)
  {   
    for (let vertex of m_vertices)
    {
      vertex.UpdateVelocity(timeStep);
    }

    DampVelocities(0.1);

    for (let vertex of m_vertices)
    {
      vertex.IntegrateVelocity(timeStep);
    }

    for (var i = 0; i < self.physicsSolverIterations; i++)
    {
      for (let constraint of m_constraints)
      {
        constraint.Project(self.physicsSolverIterations);
      }
    }

    for (let vertex of m_vertices)
    {
      vertex.FinalizeState(timeStep);
    }
    
    m_physicsTimeElapsed += timeStep;
  }
  
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
    var deltaTime = 1e-3 * (now - m_lastFrameTimeMS) + m_timeLeftOverLastFrame;
    var numWholeSteps = Math.floor(deltaTime / timeStep);
    m_timeLeftOverLastFrame = deltaTime - numWholeSteps * timeStep;

    for (var step = 0; step < numWholeSteps; step++)
    {   
      if (self.physicsEnabled)
      {
        UpdatePhysics(timeStep);
      }
    }

    // Render
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px serif';
    ctx.fillStyle = "#000";
    ctx.fillText(m_fps.toFixed(1), 20, 20);

    for (let vertex of m_vertices)
    {
      vertex.Draw(ctx);
    }

    for (let constraint of m_constraints)
    {
      constraint.Draw(ctx);
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

  this.FindObject = function(x, y)
  {
    for (var i = 0; i < m_vertices.length; i++)
    {
      if (m_vertices[i].Selected(x, y))
        return m_vertices[i];
    }
    return null;
  }

  this.AddVertex = function(vertex)
  {
    m_vertices.push(vertex);
  }

  this.AddConstraint = function(constraint)
  {
    m_constraints.push(constraint);
  }
}