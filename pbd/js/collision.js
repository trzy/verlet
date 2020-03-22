/*
 * collision.js
 * Bart Trzynadlowski, 2020
 *
 * Collision geometries with ray-based intersection testing. All geometries are
 * 2D and lie in the xy plane.
 */


function ColliderSegment(start, end, normal)
{
  this.start = start.Copy();
  this.end = end.Copy();
  this.normal = normal.Normalized();

  // Finds the point on the ray, between "to" and "from", that intersects this
  // line segment *and* enters from the side facing away from the normal
  // direction. Otherwise, returns undefined.
  this.RayCast = function(from, to)
  {
    var direction = Sub(to, from);
    var ray = new Ray(from, direction);
    var segmentLength = direction.Magnitude();

    var plane = new Plane(this.start, this.normal);
    var point = plane.Intersection(ray);
    if (point == undefined)
    {
      return undefined;
    }

    // Plane-ray intersection above is actually a line intersection test. We
    // are performing a one-sided test of a finite ray penetrating *into* the
    // surface. Check that the intersection point is within the ray bounds and
    // that the directionality is correct.
    var rayFromPoint = Sub(to, point);
    var rayFromPointLength = rayFromPoint.Magnitude();
    if (rayFromPointLength > segmentLength || Vector3.Dot(this.normal, direction) > 0)
    {
      return undefined;
    }

    // We have an intersection point with the plane. Check if it is within the
    // bounds of the line segment start -> end.
    var left = this.start.x < this.end.x ? this.start.x : this.end.x;
    var right = this.start.x < this.end.x ? this.end.x : this.start.x;
    var top = this.start.y < this.end.y ? this.end.y : this.start.y;
    var bottom = this.start.y < this.end.y ? this.start.y : this.end.y;
    if (point.x >= left && point.x <= right && point.y <= top && point.y >= bottom)
    {
      return point;
    }
    return undefined;
  }

  // Finds the intersection point, if one exists, between the line formed by
  // the two points "from" and "to", and the segment. An infinitely long line
  // is tested against the finite segment and the intersection may lie outside
  // the two points. If no intersection exists, undefined is returned.
  this.LineIntersection = function(from, to)
  {
    var direction = Sub(to, from);
    var ray = new Ray(from, direction);

    var plane = new Plane(this.start, this.normal);
    var point = plane.Intersection(ray);
    if (point == undefined)
    {
      return undefined;
    }

    // We have an intersection point with the plane. Check if it is within the
    // bounds of the line segment start -> end.
    var left = this.start.x < this.end.x ? this.start.x : this.end.x;
    var right = this.start.x < this.end.x ? this.end.x : this.start.x;
    var top = this.start.y < this.end.y ? this.end.y : this.start.y;
    var bottom = this.start.y < this.end.y ? this.start.y : this.end.y;
    if (point.x >= left && point.x <= right && point.y <= top && point.y >= bottom)
    {
      return point;
    }
    return undefined;
  }

  this.NearestPoint = function(aPoint)
  {
    var segmentDir = Sub(this.end, this.start);
    var segmentLength = segmentDir.Magnitude();
    var segmentDirNorm = Mult(segmentDir, 1.0 / segmentLength);
    var v = Sub(aPoint, this.start);
    var d = Vector3.Dot(v, segmentDirNorm);
    var t = Math.min(Math.max(d, 0), segmentLength);
    return Add(this.start, Mult(segmentDirNorm, t));
  }
}


/*
 * Collider:
 *
 * Interface describing a collision geometry.
 */

function Collider()
{
}

/*
 * Returns a dictionary of:
 *
 *  intersected:  True if an intersection occurred or false if it did not (in
 *                which case position and normal are undefined).
 *  point:        Closest intersection point to ray origin.
 *  normal:       Normal at intersection point.
 *  distance:     Distance from ray origin to intersection point.
 */

Collider.prototype.RayCast = function(from, to) {}

Collider.prototype.Draw = function(ctx) {}


/*
 * AARectangleCollider:
 *
 * An axis-aligned rectangular collider in the xy plane.
 */

function AARectangleCollider(center, width, height)
{
  this.center = center.Copy();
  this.width = width;
  this.height = height;

  var topLeft = new Vector3(center.x - 0.5 * width, center.y + 0.5 * height, 0);
  var topRight = new Vector3(center.x + 0.5 * width, center.y + 0.5 * height, 0);
  var bottomRight = new Vector3(center.x + 0.5 * width, center.y - 0.5 * height, 0);
  var bottomLeft = new Vector3(center.x - 0.5 * width, center.y - 0.5 * height, 0);

  this.surfaces = [
    new ColliderSegment(topLeft, topRight, Vector3.Up()),                 // top side
    new ColliderSegment(topRight, bottomRight, Vector3.Right()),          // right side
    new ColliderSegment(bottomRight, bottomLeft, Mult(Vector3.Up(), -1)), // bottom side
    new ColliderSegment(bottomLeft, topLeft, Mult(Vector3.Right(), -1))   // left side
  ];

  var minX = topLeft.x;
  var maxX = topRight.x;
  var minY = bottomLeft.y;
  var maxY = topLeft.y;

  this.Contains = function(point)
  {
    // >= and <= rather than > and < in order to generate static collision
    // constraints and prevent oscillations caused by a vertex repeatedly
    // entering and existing a collider due to constraint projection
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }
}

AARectangleCollider.prototype = new Collider();

AARectangleCollider.prototype.RayCast = function(from, to)
{
  if (!this.Contains(to) && !this.Contains(from))
  {
    // Fast rejection when both ray points are outside of the collider
    return { intersected: false, point: undefined, normal: undefined, distance: undefined };
  }

  var TestSurface;

  if (this.Contains(from))
  {
    //
    // Static collision.
    //
    // Starting point is inside or on surface of the collider. Collision
    // detection has failed. In this case, fall back to static collision
    // detection: look for the nearest point on the collider surface to the
    // initial motion point ("from").
    //
    // Note: Paper mentions this is necessary when *both* ray points are
    // inside the collider. To replicate that logic, we would fast-reject
    // only on "to" being outside the collider, which would mean *both*
    // points are inside the collider if we arrive here. However, this
    // creates oscillations in the case of a rope hugging a box corner:
    //
    //   +--o---- ...
    //   |+-----
    //   ||
    // v o|
    //    |
    //
    // Vertex v would oscillate. To prevent this, we want to generate the
    // static collision constraint using NearestPoint whenever the starting
    // point is just touching the surface (and might move inside it because
    // of constraint projection).
    //
    TestSurface = function(surface) { return surface.NearestPoint(from) }
  }
  else
  {
    //
    // Continuous collision.
    //
    // The motion path enters the collider. Use a directional ray cast to find
    // the intersection point if it lies between "from" and "to".
    //
    TestSurface = function(surface) { return surface.RayCast(from, to) };
  }

  // Test all 4 sides and take the nearest position, if any
  var ray = new Ray(from, Sub(to, from));
  var bestPoint = undefined;
  var bestNormal = undefined;
  var bestDistance = Infinity;

  for (let surface of this.surfaces)
  {
    var point = TestSurface(surface);
    if (point)
    {
      var distance = Vector3.Distance(point, from);
      if (distance < bestDistance)
      {
        bestPoint = point;
        bestNormal = surface.normal;
        bestDistance = distance;
      }
    }
  }

  return { intersected: bestPoint != undefined, point: bestPoint, normal: bestNormal, distance: bestDistance };
}

AARectangleCollider.prototype.Draw = function(ctx)
{
  var topLeft = new Vector3(this.center.x - 0.5 * this.width, this.center.y + 0.5 * this.height, 0);
  var canvasTopLeft = new Vector3(topLeft.x, ctx.canvas.height - topLeft.y, 0);
  ctx.beginPath();
  ctx.rect(canvasTopLeft.x, canvasTopLeft.y, this.width, this.height);
  ctx.fillStyle = "#444";
  ctx.fill();
}