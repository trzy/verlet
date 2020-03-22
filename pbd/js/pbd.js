/*
 * pbd.js
 * Bart Trzynadlowski, 2020
 *
 * Position-based dynamics system as described in:
 *
 *  Position Based Dynamics
 *  Matthias Muller, Bruno Heidelberger, Marcus Hennis, John Ratcliff
 *  3rd Workshop in Virtual Reality Interactions and Physical Simulation
 *  2006
 */


/*
 * Vertex:
 *
 * Represents a point mass and is the fundamental unit of simulation.
 */

function Vertex(x, y, mass)
{
  this.x = new Vector3(x, y, 0);
  this.p = new Vector3(x, y, 0);
  this.a = Vector3.Zero();
  this.v = Vector3.Zero();
  this.mass = mass;
  this.w = 1.0 / mass;
  this.collisionConstraint = null;
  this.fillColor = Vertex.defaultFillColor;
  this.strokeColor = Vertex.defaultStrokeColor;
}

Vertex.defaultFillColor = "#fff";
Vertex.defaultStrokeColor = "000";

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

Vertex.prototype.SetPosition = function(position)
{
  this.x = position.Copy();
  this.p = position.Copy();
}

Vertex.prototype.SetVelocity = function(velocity)
{
  this.v = velocity.Copy();
}

Vertex.prototype.SetStyle = function(fillColor, strokeColor)
{
  this.fillColor = fillColor;
  this.strokeColor = strokeColor;
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
  //if (!isFinite(this.x.x))
  //  console.log("ERROR: frame=", frameNum);
}

Vertex.prototype.Draw = function(ctx)
{
  var position = this.x;
  ctx.beginPath();
  ctx.arc(position.x, ctx.canvas.height - position.y, 4, 0, 360);
  ctx.fillStyle = this.fillColor;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = this.strokeColor;
  ctx.stroke();
}

Vertex.prototype.HitTest = function(x, y)
{
  var radius = Sub(this.Position(), new Vector3(x, y, 0)).Magnitude();
  return radius <= 10;
}


/*
 * AnchorVertex:
 *
 * A special vertex with infinite mass that does not move, as described in the
 * paper. Unfortunately, these cannot be linked with distance constraints,
 * therefore, using AnchorConstraint is the preferred way to pin vertics.
 */

function AnchorVertex(x, y)
{
  this.x = new Vector3(x, y, 0);
  this.p = new Vector3(x, y, 0);
  this.a = Vector3.Zero();
  this.v = Vector3.Zero();
  this.mass = Infinity;
  this.w = 0;
  this.collisionConstraint = null;
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


/*
 * Constraint:
 *
 * Constraint interface. The solver iterates over all constraints and projects
 * them in order to resolve vertex positions.
 *
 * Constraints are sorted in descending order of priority value. Lower values
 * are considered to be higher priority because they run last and can therefore
 * override constraints computed earlier.
 */

function Constraint()
{
  this.priority = 1;
}

Constraint.prototype.IsAttachedToBody = function(body)
{
  return false;
}

Constraint.prototype.Project = function(numSolverIterations)
{
}

Constraint.prototype.Draw = function(ctx)
{
}


/*
 * DistanceConstraint:
 *
 * Enforces a distance between two vertices. k is the stiffness parameter and
 * ranges from 0 to 1 (rigid).
 */

function DistanceConstraint(k, vertex1, vertex2, distance)
{
  this.priority = 1;
  this.vertex1 = vertex1;
  this.vertex2 = vertex2;
  this.k = k;
  this.distance = distance;
}

DistanceConstraint.prototype = new Constraint();

DistanceConstraint.prototype.IsAttachedToBody = function(body)
{
  for (let vertex of body.Vertices())
  {
    if (vertex == this.vertex1 || vertex == this.vertex2)
    {
      return true;
    }
  }
  return false;
}

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


/*
 * AnchorConstraint:
 *
 * Anchors (pins) a vertex at a given position.
 */

function AnchorConstraint(vertex, x, y)
{
  this.priority = 0;  // highest priority (applied last)
  this.vertex = vertex;
  this.position = new Vector3(x, y, 0);
}

AnchorConstraint.prototype = new Constraint();

AnchorConstraint.prototype.IsAttachedToBody = function(body)
{
  for (let vertex of body.Vertices())
  {
    if (vertex == this.vertex)
    {
      return true;
    }
  }
  return false;
}

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


/*
 * CollisionConstraint:
 *
 * Resolves a collision with a static collider by moving the vertex.
 */

function CollisionConstraint(vertex, intersectionPoint, surfaceNormal)
{
  this.priority = 0;
  this.vertex = vertex;
  this.intersectionPoint = intersectionPoint;
  this.surfaceNormal = surfaceNormal;
}

CollisionConstraint.prototype = new Constraint();

CollisionConstraint.prototype.IsAttachedToBody = function(body)
{
  for (let vertex of body.Vertices())
  {
    if (vertex == this.vertex)
    {
      return true;
    }
  }
  return false;
}

CollisionConstraint.prototype.Project = function(numSolverIterations)
{
  // This is an inequality constraint. If C(p) >= 0, projection is not
  // performed. Note: this tests directionality of the intersection and is
  // redundant if our collision raycasts already check this.
  var c = Vector3.Dot(Sub(this.vertex.p, this.intersectionPoint), this.surfaceNormal);
  if (c >= 0)
  {
    return;
  }

  var deltaP = Mult(-c, this.surfaceNormal);

  // Apply with stiffness k=1
  this.vertex.p = Add(this.vertex.p, deltaP);
}


/*
 * Body:
 *
 * A collection of vertices representing a single body. Velocity damping occurs
 * over each body.
 */

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

  this.FindVertexAt = function(x, y)
  {
    for (let vertex of m_vertices)
    {
      if (vertex.HitTest(x, y))
        return vertex;
    }
    return null;
  }
}


/*
 * PBDSystem:
 *
 * PBD physics system. Updates all bodies and constraints.
 */

function PBDSystem()
{
  this.physicsSolverIterations = 3;
  this.kDamping = 0.1;

  var m_bodies = [];
  var m_constraints = [];
  var m_colliders = [];
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
      var Li = Vector3.Cross(r[i], Mult(vertices[i].mass, vertices[i].Velocity()));
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

    // When omega is non-finite (caused by I^-1 being non-existent), the angular
    // component simply does not exist, so we should zero out omega. This occurs
    // when all the r vectors have the same two components zeroed out. For example,
    // in our 2D simulation, r_z == 0 always, and if r_x becomes 0 for all vertices
    // (e.g., a vertical un-moving chain), then I^-1 cannot be computed.
    if (!omega.IsFinite())
    {
      omega = Vector3.Zero();
    }

    for (var i = 0; i < r.length; i++)
    {
      var deltaVcm = Sub(vcm, vertices[i].Velocity());
      var deltaVangular = Vector3.Cross(omega, r[i]);
      var deltaV = Add(deltaVcm, deltaVangular);
      var newVelocity = Add(vertices[i].Velocity(), Mult(kDamping, deltaV));
      vertices[i].SetVelocity(newVelocity);
    }
  }

  function GenerateCollisionConstraints()
  {
    var collisionConstraints = [];

    for (let body of m_bodies)
    {
      for (let vertex of body.Vertices())
      {
        var from = vertex.x;
        var to = vertex.p;

        // Get possible collision points in descending order of distance from
        // vertex position before velocity update
        var collisions = m_colliders.map(collider => collider.RayCast(from, to)).filter(collision => collision.intersected);
        collisions.sort((a, b) =>
        {
          // Sort descending order of distance
          return a.distance - b.distance;
        });

        // If there is a collision, add a collider constraint for the nearest
        // collision intersection
        if (collisions.length > 0)
        {
          var collision = collisions[0];
          var constraint = new CollisionConstraint(vertex, collision.point, collision.normal);
          collisionConstraints.push(constraint);
        }
      }
    }

    return collisionConstraints;
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

    var collisionConstraints = GenerateCollisionConstraints();

    var constraints = m_constraints.slice().concat(collisionConstraints);
    constraints.sort((a, b) =>
    {
      // Higher priority (lower number) pushed to end of array
      return b.priority - a.priority;
    });

    for (var i = 0; i < self.physicsSolverIterations; i++)
    {
      for (let constraint of constraints)
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

  this.FindVertexAt = function(x, y)
  {
    for (let body of m_bodies)
    {
      var vertex = body.FindVertexAt(x, y);
      if (vertex)
      {
        return vertex;
      }
    }
    return null;
  }

  this.AddBody = function(body)
  {
    m_bodies.push(body);
  }

  this.RemoveBody = function(body)
  {
    // Remove any constraints containing body
    m_constraints = m_constraints.filter(existingConstraint => !existingConstraint.IsAttachedToBody(body));
    m_bodies = m_bodies.filter(existingBody => existingBody != body);
  }

  this.AddConstraint = function(constraint)
  {
    m_constraints.push(constraint);
  }

  this.AddCollider = function(collider)
  {
    m_colliders.push(collider);
  }

  this.Colliders = function()
  {
    return m_colliders.slice();
  }

  this.Drawables = function()
  {
    var drawables = []
    for (let body of m_bodies)
    {
      drawables = drawables.concat(body.Vertices());
    }
    return drawables.concat(m_constraints.slice()).concat(m_colliders.slice());
  }
}