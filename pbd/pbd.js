function Length(dx, dy)
{
  return Math.sqrt(dx * dx + dy * dy);
}

function Vertex(x, y, mass)
{
  this.x = new Vector3(x, y, 0);
  this.p = new Vector3(x, y, 0);
  this.a = Vector3.Zero();
  this.v = Vector3.Zero();
  this.mass = mass;
  this.w = 1.0 / mass;
}

Vertex.prototype.Position = function()
{
  return this.x.Copy();
}

Vertex.prototype.ProjectedPosition = function()
{
  return this.p.Copy();
}

Vertex.prototype.Velocity = function()
{
  return this.v.Copy();
}

Vertex.prototype.SetMass = function(mass)
{
  this.mass = mass;
  this.w = 1.0 / mass;
}

Vertex.prototype.SetVelocity = function(velocity)
{
  this.v = velocity.Copy();
}

Vertex.prototype.AddForce = function(fx, fy)
{
  var f = new Vector3(fx, fy, 0);
  this.a = Add(this.a, Mult(this.w, f));
}

Vertex.prototype.AddAcceleration = function(ax, ay)
{
  this.a = Add(this.a, new Vector3(ax, ay, 0));
}

Vertex.prototype.UpdateVelocity = function(timeStep)
{
  this.v = Add(this.v, Mult(this.a, timeStep));
}

Vertex.prototype.IntegrateVelocity = function(timeStep)
{
  this.p = Add(this.x, Mult(this.v, timeStep));
}

Vertex.prototype.FinalizeState = function(timeStep)
{
  this.v = Mult(Sub(this.p, this.x), 1.0 / timeStep); // v = (p - x) / timeStep
  this.x = this.p.Copy();
}

Vertex.prototype.Draw = function(ctx)
{
  var position = this.x;
  ctx.beginPath();
  ctx.arc(position.x, ctx.canvas.height - position.y, 4, 0, 360);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

Vertex.prototype.HitTest = function(x, y)
{
  var radius = Sub(this.Position(), new Vector3(x, y, 0)).Magnitude();
  return radius <= 10;
}

function AnchorVertex(x, y)
{
  this.x = new Vector3(x, y, 0);
  this.p = new Vector3(x, y, 0);
  this.a = Vector3.Zero();
  this.v = Vector3.Zero();
  this.mass = Infinity;
  this.w = 0;
}

AnchorVertex.prototype = new Vertex();

AnchorVertex.prototype.AddForce = function(fx, fy)
{
}

AnchorVertex.prototype.AddAcceleration = function(ax, ay)
{
}

AnchorVertex.prototype.UpdateVelocity = function(timeStep)
{
}

function Constraint()
{
}

Constraint.prototype.Project = function(numSolverIterations)
{
}

Constraint.prototype.Draw = function(ctx)
{
}

function DistanceConstraint(k, vertex1, vertex2, distance)
{
  this.priority = 1;
  this.vertex1 = vertex1;
  this.vertex2 = vertex2;
  this.k = k;
  this.distance = distance;
}

DistanceConstraint.prototype = new Constraint();

DistanceConstraint.prototype.Project = function(numSolverIterations)
{
  var k = 1 - Math.pow(1 - this.k, 1 / numSolverIterations);

  var w1 = this.vertex1.w;
  var w2 = this.vertex2.w;

  var deltaP12 = Sub(this.vertex1.p, this.vertex2.p);
  var lengthP12 = deltaP12.Magnitude();

  var s = (lengthP12 - this.distance) / lengthP12;
  var s1 = (-w1 / (w1 + w2)) * s
  var s2 = (w2 / (w1 + w2)) * s;

  var deltaP1 = Mult(s1, deltaP12);
  var deltaP2 = Mult(s2, deltaP12);

  this.vertex1.p = Add(this.vertex1.p, Mult(deltaP1, k));
  this.vertex2.p = Add(this.vertex2.p, Mult(deltaP2, k));
}

DistanceConstraint.prototype.Draw = function(ctx)
{
  var y1 = ctx.canvas.height - this.vertex1.Position().y;
  var y2 = ctx.canvas.height - this.vertex2.Position().y;
  var dx = this.vertex2.Position().x - this.vertex1.Position().x;
  var dy = y2 - y1;
  var delta = new Vector3(dx, dy, 0);
  var mag = delta.Magnitude();
  var nx = dx / mag;
  var ny = dy / mag;
  ctx.beginPath();
  ctx.moveTo(this.vertex1.Position().x + nx * 4, y1 + ny * 4);
  ctx.lineTo(this.vertex2.Position().x - nx * 4, y2 - ny * 4);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

function AnchorConstraint(vertex, x, y)
{
  this.priority = 0;  // highest priority (applied last)
  this.vertex = vertex;
  this.position = new Vector3(x, y, 0);
}

AnchorConstraint.prototype = new Constraint();

AnchorConstraint.prototype.Project = function(numSolverIterations)
{
  this.vertex.x = this.position.Copy();
  this.vertex.p = this.position.Copy();
}

AnchorConstraint.prototype.Draw = function(ctx)
{
  ctx.beginPath();
  ctx.arc(this.x, ctx.canvas.height - this.y, 4, 0, 360);
  ctx.fillStyle = "#f00";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

function Body()
{
  var m_vertices = [];

  this.Vertices = function()
  {
    return m_vertices.slice();
  }

  this.AddVertex = function(vertex)
  {
    m_vertices.push(vertex);
  }
}

function PBDSystem()
{
  this.physicsSolverIterations = 3;
  this.kDamping = 0.1;

  var m_bodies = [];
  var m_constraints = [];
  var m_physicsTimeElapsed = 0;

  var self = this;

  function DampVelocities(body, kDamping)
  {
    // Exclude vertices with non-finite mass (e.g., anchor vertices) or w == 0, which are not
    // part of the dynamic body
    var vertices = body.Vertices().filter(vertex => vertex.w != 0 && isFinite(vertex.mass));

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

  this.Update = function(timeStep)
  {
    for (let body of m_bodies)
    {
      for (let vertex of body.Vertices())
      {
        vertex.UpdateVelocity(timeStep);
      }
    }

    for (let body of m_bodies)
    {
      DampVelocities(body, self.kDamping);
    }

    for (let body of m_bodies)
    {
      for (let vertex of body.Vertices())
      {
        vertex.IntegrateVelocity(timeStep);
      }
    }

    m_constraints.sort((a, b) =>
    {
      // Higher priority (lower number) pushed to end of array
      return b.priority - a.priority;
    });

    for (var i = 0; i < self.physicsSolverIterations; i++)
    {
      for (let constraint of m_constraints)
      {
        constraint.Project(self.physicsSolverIterations);
      }
    }

    for (let body of m_bodies)
    {
      for (let vertex of body.Vertices())
      {
        vertex.FinalizeState(timeStep);
      }
    }

    m_physicsTimeElapsed += timeStep;
  }

  this.FindObjectAt = function(x, y)
  {
    for (let body of m_bodies)
    {
      for (let vertex of body.Vertices())
      {
        if (vertex.HitTest(x, y))
          return vertex;
      }
    }
    return null;
  }

  this.AddBody = function(body)
  {
    m_bodies.push(body);
  }

  this.AddConstraint = function(constraint)
  {
    m_constraints.push(constraint);
  }

  this.Drawables = function()
  {
    var drawables = []
    for (let body of m_bodies)
    {
      drawables = drawables.concat(body.Vertices());
    }
    return drawables.concat(m_constraints.slice());
  }
}